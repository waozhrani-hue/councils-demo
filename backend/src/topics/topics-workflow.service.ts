import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransitionDto } from './dto/transition.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { HierarchicalApprovalService } from '../workflow/hierarchical-approval.service';
import { DynamicPermissionService } from '../auth/dynamic-permission.service';

@Injectable()
export class TopicsWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly hierarchicalApproval: HierarchicalApprovalService,
    private readonly permissionService: DynamicPermissionService,
  ) {}

  async transition(topicId: string, dto: TransitionDto, user: JwtPayload) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { createdBy: { select: { id: true, organizationId: true } } },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const currentStatus = topic.status;

    // Get user permissions dynamically
    const userPermissions = await this.permissionService.getUserPermissions(
      user.sub,
      topic.councilId || undefined,
    );

    // Validate the transition against the workflow engine
    const transition = await this.workflowEngine.validateTransition(
      'Topic',
      currentStatus,
      dto.action,
      userPermissions,
      dto.reason,
    );

    // Determine target status
    let targetStatus = transition.toState.code;

    // Handle auto-transitions (e.g. SENT_TO_GS → INBOX_GS)
    const finalStatus = await this.workflowEngine.executeAutoTransitions(
      'Topic',
      targetStatus,
    );

    // Handle hierarchical approval: when submitting, create approval steps
    if (transition.isHierarchical && dto.action === 'SUBMIT') {
      const creator = topic.createdBy;
      if (creator?.organizationId) {
        const result = await this.hierarchicalApproval.createApprovalSteps(
          topicId,
          topic.createdById,
          creator.organizationId,
        );
        if (result.autoApproved) {
          // Creator is top manager — skip approval, go to HIERARCHY_APPROVED
          const approvedStatus = await this.workflowEngine.executeAutoTransitions(
            'Topic',
            'HIERARCHY_APPROVED',
          );
          return this.applyTransition(topicId, topic, currentStatus, approvedStatus, dto, user);
        }
        // Set first approval step
        return this.applyTransition(topicId, topic, currentStatus, finalStatus, dto, user, 1);
      }
    }

    // Handle hierarchical approval actions
    if (dto.action === 'HIERARCHY_APPROVE') {
      const result = await this.hierarchicalApproval.approveCurrentLevel(
        topicId,
        user.sub,
        dto.reason,
      );
      if (result.isComplete) {
        // All levels approved — auto-transition from HIERARCHY_APPROVED
        const nextStatus = await this.workflowEngine.executeAutoTransitions(
          'Topic',
          result.newStatus,
        );
        return this.applyTransition(topicId, topic, currentStatus, nextStatus, dto, user);
      }
      // Still pending — status stays PENDING_APPROVAL
      return this.applyTransition(topicId, topic, currentStatus, result.newStatus, dto, user);
    }

    if (dto.action === 'HIERARCHY_REJECT') {
      if (!dto.reason) throw new BadRequestException('يجب إدخال السبب');
      await this.hierarchicalApproval.rejectAtCurrentLevel(topicId, user.sub, dto.reason);
      return this.applyTransition(topicId, topic, currentStatus, 'DRAFT', dto, user);
    }

    if (dto.action === 'HIERARCHY_RETURN') {
      if (!dto.reason) throw new BadRequestException('يجب إدخال السبب');
      const result = await this.hierarchicalApproval.returnToPreviousLevel(
        topicId,
        user.sub,
        dto.reason,
      );
      return this.applyTransition(topicId, topic, currentStatus, result.newStatus, dto, user);
    }

    // Standard transition
    return this.applyTransition(topicId, topic, currentStatus, finalStatus, dto, user);
  }

  private async applyTransition(
    topicId: string,
    topic: any,
    fromStatus: string,
    toStatus: string,
    dto: TransitionDto,
    user: JwtPayload,
    approvalStepOrder?: number,
  ) {
    const newVersion = topic.currentVersion + 1;

    const updateData: Record<string, unknown> = {
      status: toStatus,
      currentVersion: newVersion,
    };

    if (dto.returnType) {
      updateData.returnType = dto.returnType;
    }

    if (toStatus === 'IN_AGENDA_BOX') {
      updateData.agendaEnteredAt = new Date();
    }

    if (approvalStepOrder !== undefined) {
      updateData.currentApprovalStepOrder = approvalStepOrder;
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
          fromStatus,
          toStatus,
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
