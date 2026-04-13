import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { WorkflowEngineService } from './workflow-engine.service';
import { DynamicPermissionService } from '../auth/dynamic-permission.service';

@Controller('workflow')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(
    private readonly workflowEngine: WorkflowEngineService,
    private readonly permissionService: DynamicPermissionService,
  ) {}

  /** Get all workflow definitions with states and transitions */
  @Get('definitions')
  async getDefinitions() {
    return this.workflowEngine.getWorkflowDefinitions();
  }

  /** Get states for a specific workflow (for StatusBadge) */
  @Get('states/:workflowCode')
  async getStates(@Param('workflowCode') workflowCode: string) {
    return this.workflowEngine.getWorkflowStates(workflowCode);
  }

  /** Get available actions for a specific entity */
  @Get('available-actions/:entityType/:entityId')
  async getAvailableActions(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Get the entity's current status
    let currentStatus: string | null = null;
    let councilId: string | undefined;

    // Use PrismaService to get the entity dynamically
    const prisma = (this.workflowEngine as any).prisma;

    if (entityType === 'Topic') {
      const topic = await prisma.topic.findUnique({ where: { id: entityId } });
      if (!topic) return [];
      currentStatus = topic.status;
      councilId = topic.councilId;
    } else if (entityType === 'Meeting') {
      const meeting = await prisma.meeting.findUnique({ where: { id: entityId } });
      if (!meeting) return [];
      currentStatus = meeting.status;
      councilId = meeting.councilId;
    } else if (entityType === 'Minutes') {
      const minutes = await prisma.minutes.findUnique({
        where: { id: entityId },
        include: { meeting: true },
      });
      if (!minutes) return [];
      currentStatus = minutes.status;
      councilId = minutes.meeting?.councilId;
    }

    if (!currentStatus) return [];

    const userPermissions = await this.permissionService.getUserPermissions(user.sub, councilId);
    return this.workflowEngine.getAvailableActions(entityType, currentStatus, userPermissions);
  }

  /** Get user's menu items based on permissions */
  @Get('menu')
  async getMenu(@CurrentUser() user: JwtPayload) {
    return this.permissionService.getUserMenuItems(user.sub);
  }

  /** Get user's permissions */
  @Get('my-permissions')
  async getMyPermissions(@CurrentUser() user: JwtPayload) {
    const permissions = await this.permissionService.getUserPermissions(user.sub);
    const roles = await this.permissionService.getUserRoles(user.sub);
    return { permissions, roles };
  }
}
