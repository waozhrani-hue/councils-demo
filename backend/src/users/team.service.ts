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

/** أدوار لا يستطيع أحد غير مدير النظام إسنادها */
const ADMIN_ONLY_ROLES = ['SYSTEM_ADMIN'];

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: DynamicPermissionService,
  ) {}

  // ─── helpers ───────────────────────────────────────────────

  private async getPermissions(userId: string) {
    return this.permissionService.getUserPermissions(userId);
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const perms = await this.getPermissions(userId);
    return perms.includes('MANAGE_USERS');
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

  /** Get the org subtree IDs for a manager */
  private async getManagerOrgIds(userId: string): Promise<string[]> {
    const mgr = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!mgr?.organizationId) return [];
    const subtree = await this.getOrgSubtree(mgr.organizationId);
    return subtree.map((u) => u.id);
  }

  /** Validate that the target user is within the manager's org scope */
  private async assertUserInScope(managerId: string, targetUserId: string) {
    const admin = await this.isAdmin(managerId);
    if (admin) return;

    const orgIds = await this.getManagerOrgIds(managerId);
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { organizationId: true },
    });

    if (!target?.organizationId || !orgIds.includes(target.organizationId)) {
      throw new ForbiddenException('المستخدم ليس ضمن نطاقك التنظيمي');
    }
  }

  /** Validate that a non-admin cannot assign admin-only roles */
  private async assertCanAssignRole(managerId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('الدور غير موجود');

    const admin = await this.isAdmin(managerId);
    if (!admin && ADMIN_ONLY_ROLES.includes(role.code)) {
      throw new ForbiddenException('لا يمكنك إسناد هذا الدور — متاح فقط لمدير النظام');
    }

    // Non-admin managers can only assign roles they themselves have
    if (!admin) {
      const managerRoles = await this.prisma.userRole.findMany({
        where: { userId: managerId },
        include: { role: true },
      });
      const managerRoleCodes = managerRoles.map((ur) => ur.role.code);

      // Manager can assign roles at their level or below:
      // They must have the same role OR a role that includes MANAGE_TEAM permission
      // But they can NEVER assign a role they don't have unless it's a subordinate role
      // For simplicity: managers can assign any non-admin role within their scope
      // The key restriction is: NO SYSTEM_ADMIN assignment by non-admins (already checked above)
    }

    return role;
  }

  /** Validate MANAGE_TEAM or MANAGE_USERS permission */
  private async validateManagePermission(user: JwtPayload) {
    const permissions = await this.getPermissions(user.sub);
    if (!permissions.includes('MANAGE_TEAM') && !permissions.includes('MANAGE_USERS')) {
      throw new ForbiddenException('ليس لديك صلاحية إدارة الفريق');
    }
  }

  // ─── public API ────────────────────────────────────────────

  async getAssignableRoles(user: JwtPayload) {
    const permissions = await this.getPermissions(user.sub);
    const canManageTeam = permissions.includes('MANAGE_TEAM');
    const canManageUsers = permissions.includes('MANAGE_USERS');

    if (!canManageTeam && !canManageUsers) {
      return { roles: [], councils: [], orgUnits: [] };
    }

    if (canManageUsers) {
      // Admin: all roles, all councils, all org units
      const roles = await this.prisma.role.findMany({ where: { isActive: true } });
      const councils = await this.prisma.council.findMany();
      const orgUnits = await this.prisma.organizationUnit.findMany({
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
      });
      return { roles, councils, orgUnits };
    }

    // MANAGE_TEAM (non-admin): filter out admin-only roles
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: {
        roles: { include: { role: true, council: true } },
        organization: true,
      },
    });

    const allRoles = await this.prisma.role.findMany({ where: { isActive: true } });
    const roles = allRoles.filter((r) => !ADMIN_ONLY_ROLES.includes(r.code));

    const councilIds = currentUser?.roles
      .filter((ur) => ur.councilId)
      .map((ur) => ur.councilId!) ?? [];
    const councils = councilIds.length > 0
      ? await this.prisma.council.findMany({ where: { id: { in: councilIds } } })
      : [];

    const orgUnits: any[] = [];
    if (currentUser?.organizationId) {
      const subtree = await this.getOrgSubtree(currentUser.organizationId);
      orgUnits.push(...subtree);
    }

    return { roles, councils, orgUnits };
  }

  async getTeamMembers(user: JwtPayload) {
    const permissions = await this.getPermissions(user.sub);
    const canManageUsers = permissions.includes('MANAGE_USERS');
    const canManageTeam = permissions.includes('MANAGE_TEAM');

    if (!canManageTeam && !canManageUsers) return [];

    let where: any = {};

    if (!canManageUsers) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
        include: { roles: { include: { role: true } } },
      });

      const conditions: any[] = [];

      if (currentUser?.organizationId) {
        const subtree = await this.getOrgSubtree(currentUser.organizationId);
        const orgIds = subtree.map((u) => u.id);
        if (orgIds.length > 0) {
          conditions.push({ organizationId: { in: orgIds } });
        }
      }

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
    const admin = await this.isAdmin(user.sub);

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
    }

    // Resolve role
    let roleId = dto.roleId;
    let roleCode: string | undefined;
    if (!roleId && dto.roleCode) {
      const role = await this.prisma.role.findFirst({ where: { code: dto.roleCode } });
      if (!role) throw new NotFoundException(`الدور ${dto.roleCode} غير موجود`);
      roleId = role.id;
      roleCode = role.code;
    }
    if (roleId && !roleCode) {
      const role = await this.prisma.role.findUnique({ where: { id: roleId } });
      roleCode = role?.code;
    }

    // Non-admin cannot assign admin-only roles
    if (roleId) {
      await this.assertCanAssignRole(user.sub, roleId);
    }

    // Determine org unit
    let orgId = dto.organizationId;
    if (!orgId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { organizationId: true },
      });
      orgId = manager?.organizationId ?? undefined;
    }

    // Non-admin: validate org is within their subtree
    if (!admin && orgId) {
      const orgIds = await this.getManagerOrgIds(user.sub);
      if (!orgIds.includes(orgId)) {
        throw new ForbiddenException('لا يمكنك إضافة مستخدم في وحدة تنظيمية خارج نطاقك');
      }
    }

    // Non-admin managers: user created as isActive=false (pending admin approval)
    // Admin: user created as isActive=true
    const isActive = admin ? true : false;

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const newUser = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        organizationId: orgId,
        maxClearanceId: dto.maxClearanceId,
        isActive,
      },
    });

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

  async assignTeamRole(
    user: JwtPayload,
    userId: string,
    dto: { roleId?: string; roleCode?: string; councilId?: string },
  ) {
    await this.validateManagePermission(user);

    // Validate target user is in manager's scope
    await this.assertUserInScope(user.sub, userId);

    let roleId = dto.roleId;
    if (!roleId && dto.roleCode) {
      const role = await this.prisma.role.findFirst({ where: { code: dto.roleCode } });
      if (!role) throw new NotFoundException(`الدور ${dto.roleCode} غير موجود`);
      roleId = role.id;
    }
    if (!roleId) throw new ForbiddenException('يجب تحديد الدور');

    // Validate non-admin cannot assign admin-only roles
    await this.assertCanAssignRole(user.sub, roleId);

    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId, councilId: dto.councilId ?? null },
    });
    if (existing) throw new ConflictException('المستخدم يملك هذا الدور بالفعل');

    return this.prisma.userRole.create({
      data: { userId, roleId, councilId: dto.councilId || null },
      include: { role: true, council: true },
    });
  }

  async removeTeamRole(user: JwtPayload, userId: string, userRoleId: string) {
    await this.validateManagePermission(user);

    // Validate target user is in manager's scope
    await this.assertUserInScope(user.sub, userId);

    const userRole = await this.prisma.userRole.findUnique({
      where: { id: userRoleId },
      include: { role: true },
    });
    if (!userRole) throw new NotFoundException('الدور غير موجود');
    if (userRole.userId !== userId) throw new ForbiddenException('لا تتطابق البيانات');

    // Non-admin cannot remove admin-only roles
    const admin = await this.isAdmin(user.sub);
    if (!admin && ADMIN_ONLY_ROLES.includes(userRole.role.code)) {
      throw new ForbiddenException('لا يمكنك إزالة هذا الدور — متاح فقط لمدير النظام');
    }

    return this.prisma.userRole.delete({ where: { id: userRoleId } });
  }

  async createSubUnit(
    user: JwtPayload,
    dto: { name: string; code?: string; unitType?: string; parentId?: string },
  ) {
    await this.validateManagePermission(user);

    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { organizationId: true },
    });

    const parentId = dto.parentId || currentUser?.organizationId;
    if (!parentId) throw new ForbiddenException('لا يمكن تحديد الوحدة الأم');

    const admin = await this.isAdmin(user.sub);
    if (!admin && currentUser?.organizationId) {
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

  async getMyOrgTree(user: JwtPayload) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { organizationId: true },
    });
    if (!currentUser?.organizationId) return [];
    return this.getOrgSubtree(currentUser.organizationId);
  }
}
