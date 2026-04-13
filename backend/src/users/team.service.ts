import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { DynamicPermissionService } from '../auth/dynamic-permission.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: DynamicPermissionService,
  ) {}

  /**
   * Get all roles the current user can assign based on MANAGE_TEAM permission
   * and their org unit scope. Fully dynamic — no hardcoded role lists.
   */
  async getAssignableRoles(user: JwtPayload) {
    const permissions = await this.permissionService.getUserPermissions(user.sub);
    const canManageTeam = permissions.includes('MANAGE_TEAM');
    const canManageUsers = permissions.includes('MANAGE_USERS'); // Admin-level

    if (!canManageTeam && !canManageUsers) {
      return { roles: [], councils: [], orgUnits: [] };
    }

    // Admin can assign any role
    if (canManageUsers) {
      const roles = await this.prisma.role.findMany({ where: { isActive: true } });
      const councils = await this.prisma.council.findMany();
      const orgUnits = await this.prisma.organizationUnit.findMany({
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
      });
      return { roles, councils, orgUnits };
    }

    // MANAGE_TEAM: get user's org unit and council scopes
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: {
        roles: { include: { role: true, council: true } },
        organization: true,
      },
    });

    // All roles the user can assign = roles at same level or below in org hierarchy
    const roles = await this.prisma.role.findMany({ where: { isActive: true } });

    // Councils the user is associated with
    const councilIds = currentUser?.roles
      .filter((ur) => ur.councilId)
      .map((ur) => ur.councilId!) ?? [];
    const councils = councilIds.length > 0
      ? await this.prisma.council.findMany({ where: { id: { in: councilIds } } })
      : [];

    // Org units this manager can manage (their unit + children)
    const orgUnits: any[] = [];
    if (currentUser?.organizationId) {
      const subtree = await this.getOrgSubtree(currentUser.organizationId);
      orgUnits.push(...subtree);
    }

    return { roles, councils, orgUnits };
  }

  /** Get the full subtree of an org unit (including itself) */
  private async getOrgSubtree(orgId: string): Promise<any[]> {
    const unit = await this.prisma.organizationUnit.findUnique({
      where: { id: orgId },
      include: { children: true },
    });
    if (!unit) return [];

    const result = [unit];
    for (const child of unit.children) {
      const subtree = await this.getOrgSubtree(child.id);
      result.push(...subtree);
    }
    return result;
  }

  /** Get team members visible to the current user */
  async getTeamMembers(user: JwtPayload) {
    const permissions = await this.permissionService.getUserPermissions(user.sub);
    const canManageUsers = permissions.includes('MANAGE_USERS');
    const canManageTeam = permissions.includes('MANAGE_TEAM');

    if (!canManageTeam && !canManageUsers) return [];

    let where: any = {};

    if (!canManageUsers) {
      // Non-admin managers: see users in their org subtree + their council members
      const currentUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
        include: { roles: { include: { role: true } } },
      });

      const conditions: any[] = [];

      // Org subtree
      if (currentUser?.organizationId) {
        const subtree = await this.getOrgSubtree(currentUser.organizationId);
        const orgIds = subtree.map((u) => u.id);
        if (orgIds.length > 0) {
          conditions.push({ organizationId: { in: orgIds } });
        }
      }

      // Council members
      const councilIds = currentUser?.roles
        .filter((ur) => ur.councilId)
        .map((ur) => ur.councilId!) ?? [];
      if (councilIds.length > 0) {
        conditions.push({
          roles: { some: { councilId: { in: councilIds } } },
        });
      }

      if (conditions.length === 0) return [];
      where = conditions.length === 1 ? conditions[0] : { OR: conditions };
    }

    // Exclude current user from results
    where = { ...where, NOT: { id: user.sub } };

    const users = await this.prisma.user.findMany({
      where,
      include: {
        roles: { include: { role: true, council: true } },
        organization: true,
        maxClearance: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map(({ passwordHash, ...rest }: any) => rest);
  }

  /** Create a new team member */
  async createTeamMember(
    user: JwtPayload,
    dto: {
      email: string;
      password: string;
      displayName: string;
      organizationId?: string;
      maxClearanceId?: string;
      roleId?: string;
      roleCode?: string;
      councilId?: string;
    },
  ) {
    await this.validateManagePermission(user);

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
    }

    // Resolve role
    let roleId = dto.roleId;
    if (!roleId && dto.roleCode) {
      const role = await this.prisma.role.findFirst({ where: { code: dto.roleCode } });
      if (!role) throw new NotFoundException(`الدور ${dto.roleCode} غير موجود`);
      roleId = role.id;
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // For org-scoped managers without explicit org, use manager's org
    let orgId = dto.organizationId;
    if (!orgId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { organizationId: true },
      });
      orgId = manager?.organizationId ?? undefined;
    }

    const newUser = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        organizationId: orgId,
        maxClearanceId: dto.maxClearanceId,
      },
    });

    // Assign role if provided
    if (roleId) {
      await this.prisma.userRole.create({
        data: {
          userId: newUser.id,
          roleId,
          councilId: dto.councilId || null,
        },
      });
    }

    const result = await this.prisma.user.findUnique({
      where: { id: newUser.id },
      include: {
        roles: { include: { role: true, council: true } },
        organization: true,
        maxClearance: true,
      },
    });

    const { passwordHash: _, ...rest } = result as any;
    return rest;
  }

  /** Assign an additional role to a team member */
  async assignTeamRole(
    user: JwtPayload,
    userId: string,
    dto: { roleId?: string; roleCode?: string; councilId?: string },
  ) {
    await this.validateManagePermission(user);

    let roleId = dto.roleId;
    if (!roleId && dto.roleCode) {
      const role = await this.prisma.role.findFirst({ where: { code: dto.roleCode } });
      if (!role) throw new NotFoundException(`الدور ${dto.roleCode} غير موجود`);
      roleId = role.id;
    }
    if (!roleId) throw new ForbiddenException('يجب تحديد الدور');

    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId, councilId: dto.councilId ?? null },
    });
    if (existing) throw new ConflictException('المستخدم يملك هذا الدور بالفعل');

    return this.prisma.userRole.create({
      data: { userId, roleId, councilId: dto.councilId || null },
      include: { role: true, council: true },
    });
  }

  /** Remove a role from a team member */
  async removeTeamRole(user: JwtPayload, userId: string, userRoleId: string) {
    await this.validateManagePermission(user);

    const userRole = await this.prisma.userRole.findUnique({
      where: { id: userRoleId },
      include: { role: true },
    });
    if (!userRole) throw new NotFoundException('الدور غير موجود');
    if (userRole.userId !== userId) throw new ForbiddenException('لا تتطابق البيانات');

    return this.prisma.userRole.delete({ where: { id: userRoleId } });
  }

  /** Create a sub-unit under the manager's org unit */
  async createSubUnit(
    user: JwtPayload,
    dto: { name: string; code?: string; unitType?: string; parentId?: string },
  ) {
    await this.validateManagePermission(user);

    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { organizationId: true },
    });

    // Determine parent: explicit parentId or manager's own org
    const parentId = dto.parentId || currentUser?.organizationId;
    if (!parentId) throw new ForbiddenException('لا يمكن تحديد الوحدة الأم');

    // Validate that parentId is within manager's subtree (unless admin)
    const permissions = await this.permissionService.getUserPermissions(user.sub);
    if (!permissions.includes('MANAGE_USERS') && currentUser?.organizationId) {
      const subtree = await this.getOrgSubtree(currentUser.organizationId);
      const validIds = subtree.map((u) => u.id);
      if (!validIds.includes(parentId)) {
        throw new ForbiddenException('لا تملك صلاحية الإنشاء تحت هذه الوحدة');
      }
    }

    const parent = await this.prisma.organizationUnit.findUnique({
      where: { id: parentId },
      select: { id: true, level: true },
    });
    if (!parent) throw new NotFoundException('الوحدة الأم غير موجودة');

    return this.prisma.organizationUnit.create({
      data: {
        name: dto.name,
        code: dto.code || `UNIT_${Date.now()}`,
        parentId,
        unitType: dto.unitType || 'SECTION',
        level: parent.level + 1,
      },
      include: { parent: { select: { id: true, name: true } } },
    });
  }

  /** Get org subtree for the current manager */
  async getMyOrgTree(user: JwtPayload) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { organizationId: true },
    });
    if (!currentUser?.organizationId) return [];
    return this.getOrgSubtree(currentUser.organizationId);
  }

  /** Validate that the user has MANAGE_TEAM or MANAGE_USERS permission */
  private async validateManagePermission(user: JwtPayload) {
    const permissions = await this.permissionService.getUserPermissions(user.sub);
    if (!permissions.includes('MANAGE_TEAM') && !permissions.includes('MANAGE_USERS')) {
      throw new ForbiddenException('ليس لديك صلاحية إدارة الفريق');
    }
  }
}
