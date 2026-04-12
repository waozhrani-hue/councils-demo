import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingTransitionDto } from './dto/meeting-transition.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface MeetingTransitionDef {
  to: string;
  requiredRole: string;
}

const MEETING_TRANSITION_MAP: Record<
  string,
  Record<string, MeetingTransitionDef>
> = {
  MEETING_DRAFT_SEC: {
    SEND_TO_GS: {
      to: 'MEETING_GS_APPROVAL',
      requiredRole: 'COUNCIL_SECRETARY',
    },
  },
  MEETING_GS_APPROVAL: {
    GS_APPROVE: {
      to: 'MEETING_BACK_SEC',
      requiredRole: 'GENERAL_SECRETARY',
    },
    GS_RETURN: {
      to: 'MEETING_DRAFT_SEC',
      requiredRole: 'GENERAL_SECRETARY',
    },
  },
  MEETING_BACK_SEC: {
    SEND_TO_PRESIDENT: {
      to: 'MEETING_PRES_APPROVAL',
      requiredRole: 'COUNCIL_SECRETARY',
    },
  },
  MEETING_PRES_APPROVAL: {
    PRESIDENT_APPROVE: {
      to: 'MEETING_SCHEDULED',
      requiredRole: 'COUNCIL_PRESIDENT',
    },
    PRESIDENT_RETURN: {
      to: 'MEETING_BACK_SEC',
      requiredRole: 'COUNCIL_PRESIDENT',
    },
  },
  MEETING_SCHEDULED: {
    HOLD: {
      to: 'MEETING_HELD',
      requiredRole: 'COUNCIL_SECRETARY',
    },
    ADJOURN: {
      to: 'MEETING_ADJOURNED',
      requiredRole: 'COUNCIL_SECRETARY',
    },
    CANCEL: {
      to: 'MEETING_CANCELLED',
      requiredRole: 'COUNCIL_SECRETARY',
    },
  },
};

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

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
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    // Link topics if provided
    if (dto.topicIds && dto.topicIds.length > 0) {
      for (let i = 0; i < dto.topicIds.length; i++) {
        const topicId = dto.topicIds[i];

        // Verify topic is in IN_AGENDA_BOX
        const topic = await this.prisma.topic.findUnique({
          where: { id: topicId },
        });
        if (!topic || topic.status !== 'IN_AGENDA_BOX') {
          throw new BadRequestException(
            `Topic ${topicId} must be in IN_AGENDA_BOX status`,
          );
        }

        await this.prisma.meetingTopicLink.create({
          data: {
            meetingId: meeting.id,
            topicId,
            orderIndex: i,
          },
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
    const roles = user.roles ?? [];
    const roleCodes = roles.map((r) => r.code);

    const where: Record<string, unknown> = {};

    const isAdmin = roleCodes.includes('SYSTEM_ADMIN');
    const isGS = roleCodes.includes('GENERAL_SECRETARY');
    const isGSStaff = roleCodes.includes('GS_OFFICE_STAFF');

    if (!isAdmin && !isGS && !isGSStaff) {
      const councilIds = roles
        .filter(
          (r) =>
            ['COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT', 'COUNCIL_MEMBER', 'EXAM_OFFICER'].includes(r.code) &&
            r.councilId,
        )
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
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        topicLinks: {
          include: {
            topic: {
              select: {
                id: true,
                refNumber: true,
                title: true,
                status: true,
              },
            },
          },
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
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        topicLinks: {
          include: {
            topic: {
              select: {
                id: true,
                refNumber: true,
                title: true,
                status: true,
              },
            },
          },
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
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        topicLinks: {
          include: {
            topic: {
              select: {
                id: true,
                refNumber: true,
                title: true,
                status: true,
              },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
        minutes: true,
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return meeting;
  }

  async transition(
    meetingId: string,
    dto: MeetingTransitionDto,
    user: JwtPayload,
  ) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        topicLinks: { include: { topic: true } },
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const actionMap = MEETING_TRANSITION_MAP[meeting.status];
    if (!actionMap || !actionMap[dto.action]) {
      throw new BadRequestException(
        `Action '${dto.action}' is not allowed from status '${meeting.status}'`,
      );
    }

    const transitionDef = actionMap[dto.action];

    // Check role
    const userRoleCodes = (user.roles ?? []).map((r) => r.code);
    if (!userRoleCodes.includes(transitionDef.requiredRole)) {
      throw new ForbiddenException(
        `Role '${transitionDef.requiredRole}' is required for this action`,
      );
    }

    const updateData: Record<string, unknown> = {
      status: transitionDef.to,
    };

    // On HOLD, set heldAt
    if (dto.action === 'HOLD') {
      updateData.heldAt = new Date();
    }

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: updateData,
      include: {
        council: true,
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        topicLinks: {
          include: { topic: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    // On ADJOURNED or CANCELLED: return all linked topics to IN_AGENDA_BOX
    if (
      transitionDef.to === 'MEETING_ADJOURNED' ||
      transitionDef.to === 'MEETING_CANCELLED'
    ) {
      for (const link of meeting.topicLinks) {
        if (link.topic.status === 'LINKED_TO_MEETING') {
          await this.prisma.topic.update({
            where: { id: link.topicId },
            data: {
              status: 'IN_AGENDA_BOX',
              agendaEnteredAt: new Date(),
            },
          });
        }
      }
    }

    return updated;
  }

  async withdrawTopic(meetingId: string, topicId: string) {
    const link = await this.prisma.meetingTopicLink.findFirst({
      where: { meetingId, topicId },
      include: { topic: true, meeting: true },
    });

    if (!link) {
      throw new NotFoundException('Topic link not found in this meeting');
    }

    if (link.topic.status !== 'LINKED_TO_MEETING') {
      throw new BadRequestException(
        'Topic must be in LINKED_TO_MEETING status to withdraw',
      );
    }

    await this.prisma.$transaction([
      this.prisma.meetingTopicLink.delete({ where: { id: link.id } }),
      this.prisma.topic.update({
        where: { id: topicId },
        data: {
          status: 'IN_AGENDA_BOX',
          agendaEnteredAt: new Date(),
        },
      }),
    ]);

    return { withdrawn: true };
  }

  async deferTopic(meetingId: string, topicId: string) {
    const link = await this.prisma.meetingTopicLink.findFirst({
      where: { meetingId, topicId },
      include: { topic: true },
    });

    if (!link) {
      throw new NotFoundException('Topic link not found in this meeting');
    }

    if (link.topic.status !== 'LINKED_TO_MEETING') {
      throw new BadRequestException(
        'Topic must be in LINKED_TO_MEETING status to defer',
      );
    }

    await this.prisma.$transaction([
      this.prisma.meetingTopicLink.update({
        where: { id: link.id },
        data: { slotStatus: 'DEFERRED' },
      }),
      this.prisma.topic.update({
        where: { id: topicId },
        data: {
          status: 'IN_AGENDA_BOX',
          agendaEnteredAt: new Date(),
        },
      }),
    ]);

    return { deferred: true };
  }

  async getAgendaBox(councilId: string) {
    return this.prisma.topic.findMany({
      where: {
        councilId,
        status: 'IN_AGENDA_BOX',
      },
      orderBy: [{ agendaOrder: 'asc' }, { agendaEnteredAt: 'asc' }],
      include: {
        secrecyLevel: true,
        requestingOrg: true,
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
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
