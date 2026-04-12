import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMinutesDto } from './dto/create-minutes.dto';
import { UpdateMinutesDto } from './dto/update-minutes.dto';
import { MinutesTransitionDto } from './dto/minutes-transition.dto';
import { MinutesFeedbackDto } from './dto/minutes-feedback.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface MinutesTransitionDef {
  to: string;
  requiredRole: string;
}

const MINUTES_TRANSITION_MAP: Record<
  string,
  Record<string, MinutesTransitionDef>
> = {
  MIN_DRAFT: {
    SEND_TO_GS: {
      to: 'MIN_GS_REVIEW',
      requiredRole: 'COUNCIL_SECRETARY',
    },
  },
  MIN_GS_REVIEW: {
    GS_RETURN: {
      to: 'MIN_GS_RETURNED',
      requiredRole: 'GENERAL_SECRETARY',
    },
    GS_APPROVE: {
      to: 'MIN_MEMBERS_CONSULT',
      requiredRole: 'GENERAL_SECRETARY',
    },
  },
  MIN_GS_RETURNED: {
    RESUBMIT_TO_GS: {
      to: 'MIN_GS_REVIEW',
      requiredRole: 'COUNCIL_SECRETARY',
    },
  },
  MIN_MEMBERS_CONSULT: {
    CLOSE_FEEDBACK: {
      to: 'MIN_TO_PRESIDENT',
      requiredRole: 'COUNCIL_SECRETARY',
    },
  },
  MIN_TO_PRESIDENT: {
    SIGN: {
      to: 'MIN_SIGNED',
      requiredRole: 'COUNCIL_PRESIDENT',
    },
    REJECT_SIGN: {
      to: 'MIN_PRES_REJECT',
      requiredRole: 'COUNCIL_PRESIDENT',
    },
  },
  MIN_PRES_REJECT: {
    GS_REWORK: {
      to: 'MIN_GS_REVIEW',
      requiredRole: 'GENERAL_SECRETARY',
    },
  },
};

@Injectable()
export class MinutesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(meetingId: string, dto: CreateMinutesDto) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Check if minutes already exist for this meeting
    const existing = await this.prisma.minutes.findUnique({
      where: { meetingId },
    });

    if (existing) {
      throw new BadRequestException(
        'Minutes already exist for this meeting',
      );
    }

    return this.prisma.minutes.create({
      data: {
        meetingId,
        status: 'MIN_DRAFT',
        body: dto.body,
      },
      include: {
        meeting: {
          include: {
            council: true,
          },
        },
        feedbacks: true,
      },
    });
  }

  async update(id: string, dto: UpdateMinutesDto) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { id },
    });

    if (!minutes) {
      throw new NotFoundException('Minutes not found');
    }

    if (
      minutes.status !== 'MIN_DRAFT' &&
      minutes.status !== 'MIN_GS_RETURNED'
    ) {
      throw new BadRequestException(
        'Minutes can only be updated in MIN_DRAFT or MIN_GS_RETURNED status',
      );
    }

    return this.prisma.minutes.update({
      where: { id },
      data: { body: dto.body },
      include: {
        meeting: {
          include: { council: true },
        },
        feedbacks: true,
      },
    });
  }

  async transition(
    id: string,
    dto: MinutesTransitionDto,
    user: JwtPayload,
  ) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { id },
    });

    if (!minutes) {
      throw new NotFoundException('Minutes not found');
    }

    const actionMap = MINUTES_TRANSITION_MAP[minutes.status];
    if (!actionMap || !actionMap[dto.action]) {
      throw new BadRequestException(
        `Action '${dto.action}' is not allowed from status '${minutes.status}'`,
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

    // On SIGN, record signing info
    if (dto.action === 'SIGN') {
      updateData.signedAt = new Date();
      updateData.signedById = user.sub;
    }

    return this.prisma.minutes.update({
      where: { id },
      data: updateData,
      include: {
        meeting: {
          include: { council: true },
        },
        signedBy: {
          select: { id: true, displayName: true, email: true },
        },
        feedbacks: {
          include: {
            member: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
      },
    });
  }

  async addFeedback(id: string, dto: MinutesFeedbackDto, userId: string) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { id },
    });

    if (!minutes) {
      throw new NotFoundException('Minutes not found');
    }

    if (minutes.status !== 'MIN_MEMBERS_CONSULT') {
      throw new BadRequestException(
        'Feedback can only be added during MIN_MEMBERS_CONSULT status',
      );
    }

    return this.prisma.minuteMemberFeedback.create({
      data: {
        minutesId: id,
        memberId: userId,
        approved: dto.approved ?? true,
        comment: dto.comment ?? '',
      },
      include: {
        member: {
          select: { id: true, displayName: true, email: true },
        },
      },
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
            },
          },
        },
        signedBy: {
          select: { id: true, displayName: true, email: true },
        },
        feedbacks: {
          include: {
            member: {
              select: { id: true, displayName: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        decisions: true,
      },
    });

    if (!minutes) {
      throw new NotFoundException('Minutes not found');
    }

    return minutes;
  }
}
