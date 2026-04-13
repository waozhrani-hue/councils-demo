import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ApprovalChainStep {
  orgUnitId: string;
  orgUnitName: string;
  managerId: string | null;
  managerName: string | null;
  stepOrder: number;
  level: number;
}

@Injectable()
export class HierarchicalApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the approval chain from a user's org unit up to the nearest isApprovalAuthority
   * Returns the chain of org units the topic must pass through
   */
  async buildApprovalChain(userOrgUnitId: string): Promise<ApprovalChainStep[]> {
    const chain: ApprovalChainStep[] = [];
    let currentUnit = await this.prisma.organizationUnit.findUnique({
      where: { id: userOrgUnitId },
      include: { manager: { select: { id: true, displayName: true } } },
    });

    if (!currentUnit) {
      throw new BadRequestException('الوحدة التنظيمية غير موجودة');
    }

    // If the user is directly in an approval authority unit,
    // the manager of that unit is the only approver
    if (currentUnit.isApprovalAuthority && currentUnit.managerId) {
      chain.push({
        orgUnitId: currentUnit.id,
        orgUnitName: currentUnit.name,
        managerId: currentUnit.managerId,
        managerName: currentUnit.manager?.displayName || null,
        stepOrder: 1,
        level: currentUnit.level,
      });
      return chain;
    }

    // Walk up the tree: from parent of current unit up to isApprovalAuthority
    let stepOrder = 0;
    let parentId = currentUnit.parentId;

    while (parentId) {
      const parentUnit = await this.prisma.organizationUnit.findUnique({
        where: { id: parentId },
        include: { manager: { select: { id: true, displayName: true } } },
      });

      if (!parentUnit) break;

      stepOrder++;
      chain.push({
        orgUnitId: parentUnit.id,
        orgUnitName: parentUnit.name,
        managerId: parentUnit.managerId,
        managerName: parentUnit.manager?.displayName || null,
        stepOrder,
        level: parentUnit.level,
      });

      // Stop when we reach the approval authority
      if (parentUnit.isApprovalAuthority) break;

      parentId = parentUnit.parentId;
    }

    // Also check if the user's own unit has a manager (for the first level)
    // Only if the user is NOT the manager of their own unit
    if (currentUnit.managerId) {
      // Insert the current unit's manager as step 0 (first approver)
      // But only if the chain doesn't already start with this unit
      const alreadyInChain = chain.some((s) => s.orgUnitId === currentUnit!.id);
      if (!alreadyInChain) {
        chain.unshift({
          orgUnitId: currentUnit.id,
          orgUnitName: currentUnit.name,
          managerId: currentUnit.managerId,
          managerName: currentUnit.manager?.displayName || null,
          stepOrder: 0,
          level: currentUnit.level,
        });
        // Re-number step orders
        chain.forEach((s, i) => (s.stepOrder = i + 1));
      }
    }

    if (chain.length === 0) {
      throw new BadRequestException('لا يوجد مسار اعتماد محدد لهذه الوحدة التنظيمية');
    }

    return chain;
  }

  /**
   * Create approval steps for a topic when it is submitted
   */
  async createApprovalSteps(topicId: string, creatorId: string, creatorOrgUnitId: string) {
    const chain = await this.buildApprovalChain(creatorOrgUnitId);

    // Filter out any step where the manager IS the creator (skip self-approval)
    const filteredChain = chain.filter((s) => s.managerId !== creatorId);

    if (filteredChain.length === 0) {
      // Creator is the top manager — auto-approve
      return { steps: [], autoApproved: true };
    }

    // Re-number
    filteredChain.forEach((s, i) => (s.stepOrder = i + 1));

    // Create the steps in the database
    for (const step of filteredChain) {
      await this.prisma.topicApprovalStep.create({
        data: {
          topicId,
          orgUnitId: step.orgUnitId,
          stepOrder: step.stepOrder,
          approverId: step.managerId,
          status: 'PENDING',
        },
      });
    }

    return { steps: filteredChain, autoApproved: false };
  }

  /**
   * Approve at the current level
   * Returns the new topic status and next step info
   */
  async approveCurrentLevel(topicId: string, approverId: string, reason?: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { approvalSteps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!topic) throw new BadRequestException('الموضوع غير موجود');
    if (topic.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('الموضوع ليس في حالة انتظار الاعتماد');
    }

    const currentStepOrder = topic.currentApprovalStepOrder || 1;
    const currentStep = topic.approvalSteps.find((s) => s.stepOrder === currentStepOrder);

    if (!currentStep) throw new BadRequestException('لا توجد خطوة اعتماد حالية');
    if (currentStep.approverId !== approverId) {
      throw new BadRequestException('ليس لديك صلاحية الاعتماد في هذه المرحلة');
    }

    // Mark current step as approved
    await this.prisma.topicApprovalStep.update({
      where: { id: currentStep.id },
      data: { status: 'APPROVED', decidedAt: new Date(), reason },
    });

    // Check if there's a next step
    const nextStep = topic.approvalSteps.find((s) => s.stepOrder === currentStepOrder + 1);

    if (nextStep) {
      // Move to next level
      await this.prisma.topic.update({
        where: { id: topicId },
        data: { currentApprovalStepOrder: nextStep.stepOrder },
      });
      return { newStatus: 'PENDING_APPROVAL', isComplete: false, nextApproverId: nextStep.approverId };
    } else {
      // All levels approved — move to HIERARCHY_APPROVED
      await this.prisma.topic.update({
        where: { id: topicId },
        data: { status: 'HIERARCHY_APPROVED', currentApprovalStepOrder: null },
      });
      return { newStatus: 'HIERARCHY_APPROVED', isComplete: true, nextApproverId: null };
    }
  }

  /**
   * Reject at any level — returns to DRAFT
   */
  async rejectAtCurrentLevel(topicId: string, approverId: string, reason: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { approvalSteps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!topic) throw new BadRequestException('الموضوع غير موجود');

    const currentStepOrder = topic.currentApprovalStepOrder || 1;
    const currentStep = topic.approvalSteps.find((s) => s.stepOrder === currentStepOrder);

    if (!currentStep || currentStep.approverId !== approverId) {
      throw new BadRequestException('ليس لديك صلاحية الرفض في هذه المرحلة');
    }

    // Mark current step as rejected
    await this.prisma.topicApprovalStep.update({
      where: { id: currentStep.id },
      data: { status: 'REJECTED', decidedAt: new Date(), reason },
    });

    // Reset all steps
    await this.prisma.topicApprovalStep.updateMany({
      where: { topicId, status: 'PENDING' },
      data: { status: 'PENDING' },
    });

    // Return to DRAFT
    await this.prisma.topic.update({
      where: { id: topicId },
      data: { status: 'DRAFT', currentApprovalStepOrder: null },
    });

    return { newStatus: 'DRAFT' };
  }

  /**
   * Return to previous level
   */
  async returnToPreviousLevel(topicId: string, approverId: string, reason: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { approvalSteps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!topic) throw new BadRequestException('الموضوع غير موجود');

    const currentStepOrder = topic.currentApprovalStepOrder || 1;
    const currentStep = topic.approvalSteps.find((s) => s.stepOrder === currentStepOrder);

    if (!currentStep || currentStep.approverId !== approverId) {
      throw new BadRequestException('ليس لديك صلاحية الإعادة في هذه المرحلة');
    }

    // Mark current step as returned
    await this.prisma.topicApprovalStep.update({
      where: { id: currentStep.id },
      data: { status: 'RETURNED', decidedAt: new Date(), reason },
    });

    if (currentStepOrder > 1) {
      // Return to previous level
      const prevStep = topic.approvalSteps.find((s) => s.stepOrder === currentStepOrder - 1);
      if (prevStep) {
        await this.prisma.topicApprovalStep.update({
          where: { id: prevStep.id },
          data: { status: 'PENDING', decidedAt: null, reason: null },
        });
        await this.prisma.topic.update({
          where: { id: topicId },
          data: { currentApprovalStepOrder: prevStep.stepOrder },
        });
        return { newStatus: 'PENDING_APPROVAL', returnedToStep: prevStep.stepOrder };
      }
    }

    // If step 1, return to DRAFT
    await this.prisma.topic.update({
      where: { id: topicId },
      data: { status: 'DRAFT', currentApprovalStepOrder: null },
    });
    return { newStatus: 'DRAFT', returnedToStep: 0 };
  }

  /**
   * Get the current approval info for a topic
   */
  async getApprovalInfo(topicId: string) {
    const steps = await this.prisma.topicApprovalStep.findMany({
      where: { topicId },
      include: {
        orgUnit: { select: { id: true, name: true, unitType: true } },
        approver: { select: { id: true, displayName: true } },
      },
      orderBy: { stepOrder: 'asc' },
    });

    return steps;
  }
}
