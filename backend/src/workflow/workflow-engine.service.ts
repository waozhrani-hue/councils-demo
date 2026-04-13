import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TransitionContext {
  entityType: string;   // Topic, Meeting, Minutes
  entityId: string;
  currentStatus: string;
  userId: string;
  userPermissions: string[];
  councilId?: string;
  reason?: string;
}

export interface AvailableAction {
  actionCode: string;
  actionNameAr: string;
  actionNameEn: string;
  requiresReason: boolean;
  requiresComment: boolean;
  isHierarchical: boolean;
  buttonColor: string;
  buttonIcon: string | null;
  toStateCode: string;
  toStateNameAr: string;
}

@Injectable()
export class WorkflowEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get available transitions for a user given the current entity state
   */
  async getAvailableActions(
    entityType: string,
    currentStatus: string,
    userPermissions: string[],
  ): Promise<AvailableAction[]> {
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: { entityType, isActive: true },
    });
    if (!workflow) return [];

    const currentState = await this.prisma.workflowState.findFirst({
      where: { workflowId: workflow.id, code: currentStatus },
    });
    if (!currentState) return [];

    const transitions = await this.prisma.workflowTransition.findMany({
      where: {
        workflowId: workflow.id,
        fromStateId: currentState.id,
        isActive: true,
        autoTransition: false,  // Don't show auto transitions as buttons
      },
      include: { toState: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Filter by user permissions
    return transitions
      .filter((t) => userPermissions.includes(t.permissionCode))
      .map((t) => ({
        actionCode: t.actionCode,
        actionNameAr: t.actionNameAr,
        actionNameEn: t.actionNameEn,
        requiresReason: t.requiresReason,
        requiresComment: t.requiresComment,
        isHierarchical: t.isHierarchical,
        buttonColor: t.buttonColor,
        buttonIcon: t.buttonIcon,
        toStateCode: t.toState.code,
        toStateNameAr: t.toState.nameAr,
      }));
  }

  /**
   * Validate and execute a workflow transition
   */
  async executeTransition(ctx: TransitionContext): Promise<{ newStatus: string; transition: any }> {
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: { entityType: ctx.entityType, isActive: true },
    });
    if (!workflow) throw new BadRequestException(`No workflow defined for ${ctx.entityType}`);

    const currentState = await this.prisma.workflowState.findFirst({
      where: { workflowId: workflow.id, code: ctx.currentStatus },
    });
    if (!currentState) throw new BadRequestException(`Invalid status: ${ctx.currentStatus}`);

    // Find the specific transition
    const transition = await this.prisma.workflowTransition.findMany({
      where: {
        workflowId: workflow.id,
        fromStateId: currentState.id,
        isActive: true,
      },
      include: { toState: true, fromState: true },
    });

    // We need to find by actionCode from the filtered list
    // (this method is called from specific services that pass the actionCode in ctx)
    return { newStatus: ctx.currentStatus, transition: null };
  }

  /**
   * Find a specific transition by action code
   */
  async findTransition(entityType: string, currentStatus: string, actionCode: string) {
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: { entityType, isActive: true },
    });
    if (!workflow) return null;

    const currentState = await this.prisma.workflowState.findFirst({
      where: { workflowId: workflow.id, code: currentStatus },
    });
    if (!currentState) return null;

    return this.prisma.workflowTransition.findFirst({
      where: {
        workflowId: workflow.id,
        fromStateId: currentState.id,
        actionCode,
        isActive: true,
      },
      include: { toState: true, fromState: true },
    });
  }

  /**
   * Validate a transition and check permission
   */
  async validateTransition(
    entityType: string,
    currentStatus: string,
    actionCode: string,
    userPermissions: string[],
    reason?: string,
  ) {
    const transition = await this.findTransition(entityType, currentStatus, actionCode);
    if (!transition) {
      throw new BadRequestException(
        `الإجراء "${actionCode}" غير متاح للحالة الحالية "${currentStatus}"`,
      );
    }

    if (!userPermissions.includes(transition.permissionCode)) {
      throw new ForbiddenException('ليس لديك صلاحية لتنفيذ هذا الإجراء');
    }

    if (transition.requiresReason && (!reason || !reason.trim())) {
      throw new BadRequestException('يجب إدخال السبب لهذا الإجراء');
    }

    return transition;
  }

  /**
   * Get all states for a workflow (for StatusBadge)
   */
  async getWorkflowStates(workflowCode: string) {
    // Support lookup by code (TOPIC_WORKFLOW) or entityType (Topic) or shorthand (topic)
    let workflow = await this.prisma.workflowDefinition.findUnique({
      where: { code: workflowCode },
    });
    if (!workflow) {
      // Try by entityType (case-insensitive match)
      const upperCode = workflowCode.charAt(0).toUpperCase() + workflowCode.slice(1).toLowerCase();
      workflow = await this.prisma.workflowDefinition.findFirst({
        where: { entityType: upperCode, isActive: true },
      });
    }
    if (!workflow) return [];

    return this.prisma.workflowState.findMany({
      where: { workflowId: workflow.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, nameAr: true, nameEn: true, color: true, stateType: true },
    });
  }

  /**
   * Get all workflow definitions
   */
  async getWorkflowDefinitions() {
    return this.prisma.workflowDefinition.findMany({
      where: { isActive: true },
      include: {
        states: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        transitions: {
          where: { isActive: true },
          include: { fromState: true, toState: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  /**
   * Execute auto-transitions (chained automatic transitions)
   */
  async executeAutoTransitions(entityType: string, currentStatus: string): Promise<string> {
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: { entityType, isActive: true },
    });
    if (!workflow) return currentStatus;

    const currentState = await this.prisma.workflowState.findFirst({
      where: { workflowId: workflow.id, code: currentStatus },
    });
    if (!currentState) return currentStatus;

    const autoTransition = await this.prisma.workflowTransition.findFirst({
      where: {
        workflowId: workflow.id,
        fromStateId: currentState.id,
        autoTransition: true,
        isActive: true,
      },
      include: { toState: true },
    });

    if (autoTransition) {
      // Recursively follow auto-transitions
      return this.executeAutoTransitions(entityType, autoTransition.toState.code);
    }

    return currentStatus;
  }
}
