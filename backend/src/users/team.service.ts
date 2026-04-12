import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

/**
 * خريطة الصلاحيات الهرمية:
 * كل دور يمكنه تعيين أدوار محددة فقط
 */
const HIERARCHY_MAP: Record<string, { allowedRoles: string[]; scope: 'council' | 'org' | 'global' }> = {
  COUNCIL_SECRETARY: {
    allowedRoles: ['COUNCIL_MEMBER', 'COUNCIL_STAFF'],
    scope: 'council',
  },
  DEPT_MANAGER: {
    allowedRoles: ['DEPT_STAFF'],
    scope: 'org',
  },
  GENERAL_SECRETARY: {
    allowedRoles: ['GS_OFFICE_STAFF'],
    scope: 'global',
  },
  SYSTEM_ADMIN: {
    allowedRoles: [
      'SYSTEM_ADMIN', 'DEPT_STAFF', 'DEPT_MANAGER', 'GENERAL_SECRETARY',
      'GS_OFFICE_STAFF', 'EXAM_OFFICER', 'COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT',
      'COUNCIL_MEMBER', 'COUNCIL_STAFF',
    ],
    scope: 'global',
  },
};

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * يحدد ما يمكن لهذا المستخدم تعيينه بناءً على أدواره
   */
  private getPermissions(user: JwtPayload) {
    const result: Array<{
      managerRole: string;
      allowedRoles: string[];
      scope: 'council' | 'org' | 'global';
      councilIds: string[];
    }> = [];

    for (const role of user.roles) {
      const config = HIERARCHY_MAP[role.code];
      if (!config) continue;
      result.push({
        managerRole: role.code,
        allowedRoles: config.allowedRoles,
        scope: config.scope,
        councilIds: role.councilId ? [role.councilId] : [],
      });
    }
    return result;
  }

  /** جميع الأدوار المسموح تعيينها */
  async getAssignableRoles(user: JwtPayload) {
    const perms = this.getPermissions(user);
    const allowedCodes = [...new Set(perms.flatMap((p) => p.allowedRoles))];

    const roles = await this.prisma.role.findMany({
      where: { code: { in: allowedCodes } },
    });

    // أمين المجلس: يحتاج المجالس التي يديرها
    const councilIds = [...new Set(perms.flatMap((p) => p.councilIds))];
    const councils = councilIds.length > 0
      ? await this.prisma.council.findMany({ where: { id: { in: councilIds } } })
      : [];

    return { roles, councils, permissions: perms };
  }

  /** قائمة أعضاء الفريق حسب صلاحيات المدير */
  async getTeamMembers(user: JwtPayload) {
    const perms = this.getPermissions(user);
    if (perms.length === 0) return [];

    const allAllowedCodes = [...new Set(perms.flatMap((p) => p.allowedRoles))];
    const allCouncilIds = [...new Set(perms.flatMap((p) => p.councilIds))];

    // بناء شروط البحث
    const conditions: any[] = [];

    for (const perm of perms) {
      if (perm.scope === 'council' && perm.councilIds.length > 0) {
        // أمين المجلس: أعضاء مجلسه فقط
        conditions.push({
          roles: {
            some: {
              role: { code: { in: perm.allowedRoles } },
              councilId: { in: perm.councilIds },
            },
          },
        });
      } else if (perm.scope === 'org') {
        // مدير الإدارة: موظفو إدارته فقط
        const manager = await this.prisma.user.findUnique({
          where: { id: user.sub },
          select: { organizationId: true },
        });
        if (manager?.organizationId) {
          conditions.push({
            organizationId: manager.organizationId,
            roles: {
              some: { role: { code: { in: perm.allowedRoles } } },
            },
          });
        }
      } else if (perm.scope === 'global') {
        // الأمين العام / مدير النظام
        conditions.push({
          roles: {
            some: { role: { code: { in: perm.allowedRoles } } },
          },
        });
      }
    }

    if (conditions.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: conditions.length === 1 ? conditions[0] : { OR: conditions },
      include: {
        roles: { include: { role: true, council: true } },
        organization: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map(({ passwordHash, ...rest }: any) => rest);
  }

  /** إنشاء عضو فريق جديد مع التحقق من الصلاحيات */
  async createTeamMember(
    user: JwtPayload,
    dto: {
      email: string;
      password: string;
      displayName: string;
      organizationId?: string;
      maxClearanceId?: string;
      roleCode: string;
      councilId?: string;
    },
  ) {
    // التحقق من صلاحية التعيين
    this.validateAssignment(user, dto.roleCode, dto.councilId);

    // التحقق من عدم تكرار البريد
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role = await this.prisma.role.findFirst({
      where: { code: dto.roleCode },
    });
    if (!role) throw new NotFoundException(`الدور ${dto.roleCode} غير موجود`);

    // لمدير الإدارة: الموظف يُنشأ في نفس الإدارة تلقائياً
    let orgId = dto.organizationId;
    if (!orgId) {
      const perms = this.getPermissions(user);
      const isOrgScope = perms.some((p) => p.scope === 'org');
      if (isOrgScope) {
        const manager = await this.prisma.user.findUnique({
          where: { id: user.sub },
          select: { organizationId: true },
        });
        orgId = manager?.organizationId ?? undefined;
      }
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

    // تعيين الدور
    await this.prisma.userRole.create({
      data: {
        userId: newUser.id,
        roleId: role.id,
        councilId: dto.councilId || null,
      },
    });

    const result = await this.prisma.user.findUnique({
      where: { id: newUser.id },
      include: {
        roles: { include: { role: true, council: true } },
        organization: true,
      },
    });

    const { passwordHash: _, ...rest } = result as any;
    return rest;
  }

  /** تعيين دور إضافي لعضو فريق */
  async assignTeamRole(
    user: JwtPayload,
    userId: string,
    dto: { roleId?: string; roleCode?: string; councilId?: string },
  ) {
    let roleCode = dto.roleCode;
    let roleId = dto.roleId;

    if (roleCode && !roleId) {
      const role = await this.prisma.role.findFirst({ where: { code: roleCode } });
      if (!role) throw new NotFoundException(`الدور ${roleCode} غير موجود`);
      roleId = role.id;
    } else if (roleId && !roleCode) {
      const role = await this.prisma.role.findUnique({ where: { id: roleId } });
      if (!role) throw new NotFoundException(`الدور غير موجود`);
      roleCode = role.code;
    }

    if (!roleCode || !roleId) {
      throw new ForbiddenException('يجب تحديد الدور');
    }

    this.validateAssignment(user, roleCode, dto.councilId);

    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId, councilId: dto.councilId ?? null },
    });
    if (existing) throw new ConflictException('المستخدم يملك هذا الدور بالفعل');

    return this.prisma.userRole.create({
      data: { userId, roleId, councilId: dto.councilId || null },
      include: { role: true, council: true },
    });
  }

  /** إزالة دور من عضو فريق */
  async removeTeamRole(
    user: JwtPayload,
    userId: string,
    userRoleId: string,
  ) {
    const userRole = await this.prisma.userRole.findUnique({
      where: { id: userRoleId },
      include: { role: true },
    });
    if (!userRole) throw new NotFoundException('الدور غير موجود');
    if (userRole.userId !== userId) throw new ForbiddenException('لا تتطابق البيانات');

    // تحقق أن المدير يملك صلاحية إزالة هذا الدور
    this.validateAssignment(user, userRole.role.code, userRole.councilId ?? undefined);

    return this.prisma.userRole.delete({ where: { id: userRoleId } });
  }

  /** التحقق من صلاحية التعيين */
  private validateAssignment(user: JwtPayload, roleCode: string, councilId?: string) {
    const perms = this.getPermissions(user);

    for (const perm of perms) {
      if (!perm.allowedRoles.includes(roleCode)) continue;

      if (perm.scope === 'council') {
        // أمين المجلس: يجب أن يكون councilId من مجالسه
        if (!councilId) {
          throw new ForbiddenException('يجب تحديد المجلس');
        }
        if (!perm.councilIds.includes(councilId)) {
          throw new ForbiddenException('لا تملك صلاحية على هذا المجلس');
        }
        return; // مسموح
      }

      // org أو global: مسموح
      return;
    }

    throw new ForbiddenException(
      `لا تملك صلاحية تعيين الدور: ${roleCode}`,
    );
  }
}
