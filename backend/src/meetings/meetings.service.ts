import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingTransitionDto } from './dto/meeting-transition.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { DynamicPermissionService } from '../auth/dynamic-permission.service';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly permissionService: DynamicPermissionService,
  ) {}

  async create(councilId: string, dto: CreateMeetingDto, userId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.meeting.count({
      where: { refNumber: { startsWith: `MTG-${year}-` } },
    });
    const refNumber = `MTG-${year}-${String(count + 1).padStart(5, '0')}`;

    const meeting = await this.prisma.meeting.create({
      data: {
        refNumber,
        councilId,
        title: dto.title,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        location: dto.location,
        createdById: userId,
        status: 'MEETING_DRAFT_SEC',
      },
      include: {
        council: true,
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    });

    if (dto.topicIds && dto.topicIds.length > 0) {
      for (let i = 0; i < dto.topicIds.length; i++) {
        const topicId = dto.topicIds[i];
        const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
        if (!topic || topic.status !== 'IN_AGENDA_BOX') {
          throw new BadRequestException(`Topic ${topicId} must be in IN_AGENDA_BOX status`);
        }
        await this.prisma.meetingTopicLink.create({
          data: { meetingId: meeting.id, topicId, orderIndex: i },
        });
        await this.prisma.topic.update({
          where: { id: topicId },
          data: { status: 'LINKED_TO_MEETING' },
        });
      }
    }

    return this.findById(meeting.id);
  }

  async findAll(user: JwtPayload) {
    const permissions = await this.permissionService.getUserPermissions(user.sub);
    const userRoles = await this.permissionService.getUserRoles(user.sub);
    const where: Record<string, unknown> = {};

    const canViewAll = permissions.includes('VIEW_ALL_TOPICS') || permissions.includes('MANAGE_USERS');

    if (!canViewAll) {
      const councilIds = userRoles
        .filter((r) => r.scope === 'COUNCIL' && r.councilId)
        .map((r) => r.councilId!);

      if (councilIds.length > 0) {
        where.councilId = { in: councilIds };
      } else {
        where.councilId = '__none__';
      }
    }

    return this.prisma.meeting.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        council: true,
        createdBy: { select: { id: true, displayName: true, email: true } },
        topicLinks: {
          include: { topic: { select: { id: true, refNumber: true, title: true, status: true } } },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  async findByCouncil(councilId: string) {
    return this.prisma.meeting.findMany({
      where: { councilId },
      orderBy: { createdAt: 'desc' },
      include: {
        council: true,
        createdBy: { select: { id: true, displayName: true, email: true } },
        topicLinks: {
          include: { topic: { select: { id: true, refNumber: true, title: true, status: true } } },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  async findById(id: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: {
        council: true,
        createdBy: { select: { id: true, displayName: true, email: true } },
        topicLinks: {
          include: { topic: { select: { id: true, refNumber: true, title: true, status: true } } },
          orderBy: { orderIndex: 'asc' },
        },
        minutes: true,
      },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  async transition(meetingId: string, dto: MeetingTransitionDto, user: JwtPayload) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { topicLinks: { include: { topic: true } } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const userPermissions = await this.permissionService.getUserPermissions(
      user.sub,
      meeting.councilId || undefined,
    );

    const transition = await this.workflowEngine.validateTransition(
      'Meeting', meeting.status, dto.action, userPermissions, dto.reason,
    );

    let targetStatus = transition.toState.code;
    targetStatus = await this.workflowEngine.executeAutoTransitions('Meeting', targetStatus);

    const updateData: Record<string, unknown> = { status: targetStatus };
    if (dto.action === 'HOLD') updateData.heldAt = new Date();

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: updateData,
      include: {
        council: true,
        createdBy: { select: { id: true, displayName: true, email: true } },
        topicLinks: { include: { topic: true }, orderBy: { orderIndex: 'asc' } },
      },
    });

    if (targetStatus === 'MEETING_ADJOURNED' || targetStatus === 'MEETING_CANCELLED') {
      for (const link of meeting.topicLinks) {
        if (link.topic.status === 'LINKED_TO_MEETING') {
          await this.prisma.topic.update({
            where: { id: link.topicId },
            data: { status: 'IN_AGENDA_BOX', agendaEnteredAt: new Date() },
          });
        }
      }
    }

    return updated;
  }

  async withdrawTopic(meetingId: string, topicId: string) {
    const link = await this.prisma.meetingTopicLink.findFirst({
      where: { meetingId, topicId },
      include: { topic: true },
    });
    if (!link) throw new NotFoundException('Topic link not found in this meeting');
    if (link.topic.status !== 'LINKED_TO_MEETING') {
      throw new BadRequestException('Topic must be in LINKED_TO_MEETING status to withdraw');
    }

    await this.prisma.$transaction([
      this.prisma.meetingTopicLink.delete({ where: { id: link.id } }),
      this.prisma.topic.update({
        where: { id: topicId },
        data: { status: 'IN_AGENDA_BOX', agendaEnteredAt: new Date() },
      }),
    ]);
    return { withdrawn: true };
  }

  async deferTopic(meetingId: string, topicId: string) {
    const link = await this.prisma.meetingTopicLink.findFirst({
      where: { meetingId, topicId },
      include: { topic: true },
    });
    if (!link) throw new NotFoundException('Topic link not found in this meeting');
    if (link.topic.status !== 'LINKED_TO_MEETING') {
      throw new BadRequestException('Topic must be in LINKED_TO_MEETING status to defer');
    }

    await this.prisma.$transaction([
      this.prisma.meetingTopicLink.update({ where: { id: link.id }, data: { slotStatus: 'DEFERRED' } }),
      this.prisma.topic.update({
        where: { id: topicId },
        data: { status: 'IN_AGENDA_BOX', agendaEnteredAt: new Date() },
      }),
    ]);
    return { deferred: true };
  }

  async getAgendaBox(councilId: string) {
    return this.prisma.topic.findMany({
      where: { councilId, status: 'IN_AGENDA_BOX' },
      orderBy: [{ agendaOrder: 'asc' }, { agendaEnteredAt: 'asc' }],
      include: {
        secrecyLevel: true,
        requestingOrg: true,
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  async reorderAgendaBox(councilId: string, orderedTopicIds: string[]) {
    const updates = orderedTopicIds.map((topicId, index) =>
      this.prisma.topic.updateMany({
        where: { id: topicId, councilId, status: 'IN_AGENDA_BOX' },
        data: { agendaOrder: index },
      }),
    );
    await this.prisma.$transaction(updates);
    return this.getAgendaBox(councilId);
  }
}
