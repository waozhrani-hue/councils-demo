import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransitionDto } from './dto/transition.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface TransitionDef {
  to: string;
  requiredRole: string;
  reasonRequired?: boolean;
  returnTypeRequired?: boolean;
  /** For RETURNED_COUNCIL: target depends on returnType */
  conditionalTarget?: Record<string, string>;
}

const TRANSITION_MAP: Record<string, Record<string, TransitionDef>> = {
  DRAFT: {
    SUBMIT_TO_MANAGER: {
      to: 'PENDING_DEPT_MGR',
      requiredRole: 'DEPT_STAFF',
    },
  },
  PENDING_DEPT_MGR: {
    APPROVE: {
      to: 'APPROVED',
      requiredRole: 'DEPT_MANAGER',
    },
    RETURN_TO_DRAFT: {
      to: 'DRAFT',
      requiredRole: 'DEPT_MANAGER',
      reasonRequired: true,
    },
  },
  APPROVED: {
    SEND_TO_GS: {
      to: 'SENT_TO_GS',
      requiredRole: 'DEPT_MANAGER',
    },
    REVOKE_APPROVAL: {
      to: 'DRAFT',
      requiredRole: 'DEPT_MANAGER',
    },
  },
  SENT_TO_GS: {
    // auto-transition to INBOX_GS handled on creation
  },
  INBOX_GS: {
    // auto-transition to GS_REVIEW on access — no explicit action needed
  },
  GS_REVIEW: {
    ACCEPT: {
      to: 'WITH_COUNCIL',
      requiredRole: 'GENERAL_SECRETARY',
    },
    SUSPEND: {
      to: 'SUSPENDED',
      requiredRole: 'GENERAL_SECRETARY',
      reasonRequired: true,
    },
    REJECT: {
      to: 'RETURNED_DEPT',
      requiredRole: 'GENERAL_SECRETARY',
      reasonRequired: true,
    },
    RETURN_WRONG_COUNCIL: {
      to: 'RETURNED_DEPT',
      requiredRole: 'GENERAL_SECRETARY',
      reasonRequired: true,
    },
  },
  SUSPENDED: {
    RESUME: {
      to: 'GS_REVIEW',
      requiredRole: 'GENERAL_SECRETARY',
    },
  },
  RETURNED_DEPT: {
    RESUBMIT: {
      to: 'SENT_TO_GS',
      requiredRole: 'DEPT_MANAGER',
    },
    CLOSE_BY_DEPT: {
      to: 'CLOSED_BY_DEPT',
      requiredRole: 'DEPT_MANAGER',
    },
  },
  WITH_COUNCIL: {
    ASSIGN_EXAM: {
      to: 'EXAM_IN_PROGRESS',
      requiredRole: 'COUNCIL_SECRETARY',
    },
  },
  EXAM_IN_PROGRESS: {
    EXAM_PASS: {
      to: 'EXAM_COMPLETE',
      requiredRole: 'EXAM_OFFICER',
    },
    EXAM_FAIL: {
      to: 'EXAM_INCOMPLETE',
      requiredRole: 'EXAM_OFFICER',
      reasonRequired: true,
    },
  },
  EXAM_INCOMPLETE: {
    REEXAM: {
      to: 'EXAM_IN_PROGRESS',
      requiredRole: 'COUNCIL_SECRETARY',
    },
  },
  EXAM_COMPLETE: {
    SUBMIT_TO_PRESIDENT: {
      to: 'PRESIDENT_REVIEW',
      requiredRole: 'COUNCIL_SECRETARY',
    },
  },
  PRESIDENT_REVIEW: {
    MARK_SUITABLE: {
      to: 'IN_AGENDA_BOX',
      requiredRole: 'COUNCIL_PRESIDENT',
    },
    RETURN_TO_COUNCIL: {
      to: 'RETURNED_COUNCIL',
      requiredRole: 'COUNCIL_PRESIDENT',
      reasonRequired: true,
      returnTypeRequired: true,
    },
  },
  RETURNED_COUNCIL: {
    // Target depends on returnType stored on the topic
    REEXAM: {
      to: 'EXAM_IN_PROGRESS',
      requiredRole: 'COUNCIL_SECRETARY',
      conditionalTarget: {
        FULL_REEXAM: 'EXAM_IN_PROGRESS',
      },
    },
    SUBMIT_TO_PRESIDENT: {
      to: 'PRESIDENT_REVIEW',
      requiredRole: 'COUNCIL_SECRETARY',
      conditionalTarget: {
        PATH_CORRECTION: 'PRESIDENT_REVIEW',
      },
    },
  },
  IN_AGENDA_BOX: {
    LINK_TO_MEETING: {
      to: 'LINKED_TO_MEETING',
      requiredRole: 'COUNCIL_SECRETARY',
    },
  },
  LINKED_TO_MEETING: {
    WITHDRAW_FROM_MEETING: {
      to: 'IN_AGENDA_BOX',
      requiredRole: 'COUNCIL_SECRETARY',
    },
    DEFER_IN_SESSION: {
      to: 'DEFERRED_IN_SESSION',
      requiredRole: 'COUNCIL_PRESIDENT',
    },
    MARK_DISCUSSED: {
      to: 'DISCUSSED',
      requiredRole: 'SYSTEM', // system action
    },
  },
  DEFERRED_IN_SESSION: {
    // auto back to IN_AGENDA_BOX
  },
};

@Injectable()
export class TopicsWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async transition(
    topicId: string,
    dto: TransitionDto,
    user: JwtPayload,
  ) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const currentStatus = topic.status;
    const actionMap = TRANSITION_MAP[currentStatus];

    if (!actionMap || !actionMap[dto.action]) {
      throw new BadRequestException(
        `Action '${dto.action}' is not allowed from status '${currentStatus}'`,
      );
    }

    const transitionDef = actionMap[dto.action];

    // For RETURNED_COUNCIL, validate returnType matches
    if (transitionDef.conditionalTarget) {
      const topicReturnType = topic.returnType;
      if (!topicReturnType || !transitionDef.conditionalTarget[topicReturnType]) {
        throw new BadRequestException(
          `Action '${dto.action}' is not allowed for returnType '${topicReturnType}'`,
        );
      }
    }

    // Check required role (skip for system actions)
    if (transitionDef.requiredRole !== 'SYSTEM') {
      const userRoleCodes = (user.roles ?? []).map((r) => r.code);
      const hasRole = userRoleCodes.includes(transitionDef.requiredRole);

      if (!hasRole) {
        // Check delegations
        const now = new Date();
        const delegation = await this.prisma.delegation.findFirst({
          where: {
            toUserId: user.sub,
            state: 'ACTIVE',
            validFrom: { lte: now },
            validUntil: { gte: now },
          },
        });

        let hasDelegatedRole = false;
        if (delegation) {
          try {
            const scope = JSON.parse(delegation.scopeJson);
            const delegatedCodes: string[] = [];
            if (scope.roleCode) delegatedCodes.push(scope.roleCode);
            if (Array.isArray(scope.roleCodes))
              delegatedCodes.push(...scope.roleCodes);
            hasDelegatedRole = delegatedCodes.includes(
              transitionDef.requiredRole,
            );
          } catch {
            // ignore parse errors
          }
        }

        if (!hasDelegatedRole) {
          throw new ForbiddenException(
            `Role '${transitionDef.requiredRole}' is required for this action`,
          );
        }
      }
    }

    // Check reason required
    if (transitionDef.reasonRequired && !dto.reason) {
      throw new BadRequestException('Reason is required for this action');
    }

    // Check returnType required (for RETURN_TO_COUNCIL)
    if (transitionDef.returnTypeRequired && !dto.returnType) {
      throw new BadRequestException('returnType is required for this action');
    }

    const targetStatus = transitionDef.to;
    const newVersion = topic.currentVersion + 1;

    const updateData: Record<string, unknown> = {
      status: targetStatus,
      currentVersion: newVersion,
    };

    // Store returnType on the topic for RETURN_TO_COUNCIL
    if (dto.returnType) {
      updateData.returnType = dto.returnType;
    }

    // When entering IN_AGENDA_BOX, set agendaEnteredAt
    if (targetStatus === 'IN_AGENDA_BOX') {
      updateData.agendaEnteredAt = new Date();
    }

    // Handle auto-transitions
    let finalStatus = targetStatus;

    // SENT_TO_GS auto-transitions to INBOX_GS
    if (targetStatus === 'SENT_TO_GS') {
      finalStatus = 'INBOX_GS';
      updateData.status = 'INBOX_GS';
    }

    // DEFERRED_IN_SESSION auto-transitions back to IN_AGENDA_BOX
    if (targetStatus === 'DEFERRED_IN_SESSION') {
      finalStatus = 'IN_AGENDA_BOX';
      updateData.status = 'IN_AGENDA_BOX';
      updateData.agendaEnteredAt = new Date();
    }

    const [updatedTopic] = await this.prisma.$transaction([
      this.prisma.topic.update({
        where: { id: topicId },
        data: updateData,
        include: {
          council: true,
          secrecyLevel: true,
          requestingOrg: true,
          createdBy: {
            select: { id: true, displayName: true, email: true },
          },
        },
      }),
      this.prisma.topicStatusLog.create({
        data: {
          topicId,
          fromStatus: currentStatus,
          toStatus: finalStatus,
          action: dto.action,
          actorId: user.sub,
          reason: dto.reason,
          version: newVersion,
        },
      }),
    ]);

    return updatedTopic;
  }
}
