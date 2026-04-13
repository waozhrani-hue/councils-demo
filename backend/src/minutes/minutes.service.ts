import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMinutesDto } from './dto/create-minutes.dto';
import { UpdateMinutesDto } from './dto/update-minutes.dto';
import { MinutesTransitionDto } from './dto/minutes-transition.dto';
import { MinutesFeedbackDto } from './dto/minutes-feedback.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { DynamicPermissionService } from '../auth/dynamic-permission.service';

@Injectable()
export class MinutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly permissionService: DynamicPermissionService,
  ) {}

  async create(meetingId: string, dto: CreateMinutesDto) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const existing = await this.prisma.minutes.findUnique({ where: { meetingId } });
    if (existing) throw new BadRequestException('Minutes already exist for this meeting');

    return this.prisma.minutes.create({
      data: { meetingId, status: 'MIN_DRAFT', body: dto.body },
      include: { meeting: { include: { council: true } }, feedbacks: true },
    });
  }

  async update(id: string, dto: UpdateMinutesDto) {
    const minutes = await this.prisma.minutes.findUnique({ where: { id } });
    if (!minutes) throw new NotFoundException('Minutes not found');
    if (minutes.status !== 'MIN_DRAFT' && minutes.status !== 'MIN_GS_RETURNED') {
      throw new BadRequestException('Minutes can only be updated in MIN_DRAFT or MIN_GS_RETURNED status');
    }

    return this.prisma.minutes.update({
      where: { id },
      data: { body: dto.body },
      include: { meeting: { include: { council: true } }, feedbacks: true },
    });
  }

  async transition(id: string, dto: MinutesTransitionDto, user: JwtPayload) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { id },
      include: { meeting: true },
    });
    if (!minutes) throw new NotFoundException('Minutes not found');

    const councilId = minutes.meeting?.councilId || undefined;
    const userPermissions = await this.permissionService.getUserPermissions(user.sub, councilId);

    const transition = await this.workflowEngine.validateTransition(
      'Minutes', minutes.status, dto.action, userPermissions, dto.reason,
    );

    let targetStatus = transition.toState.code;
    targetStatus = await this.workflowEngine.executeAutoTransitions('Minutes', targetStatus);

    const updateData: Record<string, unknown> = { status: targetStatus };
    if (dto.action === 'SIGN') {
      updateData.signedAt = new Date();
      updateData.signedById = user.sub;
    }

    return this.prisma.minutes.update({
      where: { id },
      data: updateData,
      include: {
        meeting: { include: { council: true } },
        signedBy: { select: { id: true, displayName: true, email: true } },
        feedbacks: {
          include: { member: { select: { id: true, displayName: true, email: true } } },
        },
      },
    });
  }

  async addFeedback(id: string, dto: MinutesFeedbackDto, userId: string) {
    const minutes = await this.prisma.minutes.findUnique({ where: { id } });
    if (!minutes) throw new NotFoundException('Minutes not found');
    if (minutes.status !== 'MIN_MEMBERS_CONSULT') {
      throw new BadRequestException('Feedback can only be added during MIN_MEMBERS_CONSULT status');
    }

    return this.prisma.minuteMemberFeedback.create({
      data: {
        minutesId: id,
        memberId: userId,
        approved: dto.approved ?? true,
        comment: dto.comment ?? '',
      },
      include: { member: { select: { id: true, displayName: true, email: true } } },
    });
  }

  async findById(id: string) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { id },
      include: {
        meeting: {
          include: {
            council: true,
            topicLinks: {
              include: { topic: { select: { id: true, refNumber: true, title: true, status: true } } },
            },
          },
        },
        signedBy: { select: { id: true, displayName: true, email: true } },
        feedbacks: {
          include: { member: { select: { id: true, displayName: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
        decisions: true,
      },
    });
    if (!minutes) throw new NotFoundException('Minutes not found');
    return minutes;
  }
}
