import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { WorkflowEngineService } from './workflow-engine.service';
import { DynamicPermissionService } from '../auth/dynamic-permission.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('workflow')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(
    private readonly workflowEngine: WorkflowEngineService,
    private readonly permissionService: DynamicPermissionService,
    private readonly prisma: PrismaService,
  ) {}

  // ═══════════════ Workflow Definitions ═══════════════

  @Get('definitions')
  async getDefinitions() {
    return this.workflowEngine.getWorkflowDefinitions();
  }

  @Get('states/:workflowCode')
  async getStates(@Param('workflowCode') workflowCode: string) {
    return this.workflowEngine.getWorkflowStates(workflowCode);
  }

  @Get('available-actions/:entityType/:entityId')
  async getAvailableActions(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    let currentStatus: string | null = null;
    let councilId: string | undefined;

    if (entityType === 'Topic') {
      const topic = await this.prisma.topic.findUnique({ where: { id: entityId } });
      if (!topic) return [];
      currentStatus = topic.status;
      councilId = topic.councilId;
    } else if (entityType === 'Meeting') {
      const meeting = await this.prisma.meeting.findUnique({ where: { id: entityId } });
      if (!meeting) return [];
      currentStatus = meeting.status;
      councilId = meeting.councilId;
    } else if (entityType === 'Minutes') {
      const minutes = await this.prisma.minutes.findUnique({
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

  @Get('menu')
  async getMenu(@CurrentUser() user: JwtPayload) {
    return this.permissionService.getUserMenuItems(user.sub);
  }

  @Get('my-permissions')
  async getMyPermissions(@CurrentUser() user: JwtPayload) {
    const permissions = await this.permissionService.getUserPermissions(user.sub);
    const roles = await this.permissionService.getUserRoles(user.sub);
    return { permissions, roles };
  }

  // ═══════════════ Roles CRUD ═══════════════

  @Get('roles')
  async getRoles() {
    return this.prisma.role.findMany({
      orderBy: { nameAr: 'asc' },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
  }

  @Post('roles')
  async createRole(@Body() dto: { code: string; nameAr: string; nameEn: string; description?: string; scope?: string; permissionIds?: string[] }) {
    const role = await this.prisma.role.create({
      data: {
        code: dto.code,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        description: dto.description,
        scope: dto.scope || 'GLOBAL',
        isSystem: false,
      },
    });

    if (dto.permissionIds?.length) {
      for (const permissionId of dto.permissionIds) {
        await this.prisma.rolePermission.create({
          data: { roleId: role.id, permissionId },
        });
      }
    }

    return this.prisma.role.findUnique({
      where: { id: role.id },
      include: { permissions: { include: { permission: true } } },
    });
  }

  @Patch('roles/:id')
  async updateRole(@Param('id') id: string, @Body() dto: { nameAr?: string; nameEn?: string; description?: string; scope?: string; permissionIds?: string[] }) {
    await this.prisma.role.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        description: dto.description,
        scope: dto.scope,
      },
    });

    if (dto.permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      for (const permissionId of dto.permissionIds) {
        await this.prisma.rolePermission.create({
          data: { roleId: id, permissionId },
        });
      }
    }

    return this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
  }

  // ═══════════════ Permissions (read-only) ═══════════════

  @Get('permissions')
  async getPermissions() {
    return this.prisma.permission.findMany({
      where: { isActive: true },
      orderBy: [{ module: 'asc' }, { nameAr: 'asc' }],
    });
  }
}
