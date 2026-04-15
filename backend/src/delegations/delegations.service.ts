import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';

const DELEGATION_STATES = {
  DRAFT: 'DELEGATION_DRAFT',
  ACTIVE: 'DELEGATION_ACTIVE',
  REVOKED: 'DELEGATION_REVOKED',
  SUSPENDED: 'DELEGATION_SUSPENDED',
} as const;

@Injectable()
export class DelegationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List delegations — only the user's own (from/to) unless admin
   */
  async findAll(currentUserId: string, isAdmin: boolean, query: { state?: string }) {
    const where: any = {};

    if (!isAdmin) {
      where.OR = [
        { fromUserId: currentUserId },
        { toUserId: currentUserId },
      ];
    }

    if (query.state) {
      where.state = query.state;
    }

    return this.prisma.delegation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        fromUser: { select: { id: true, displayName: true, email: true } },
        toUser: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  async findById(id: string) {
    const delegation = await this.prisma.delegation.findUnique({
      where: { id },
      include: {
        fromUser: { select: { id: true, displayName: true, email: true } },
        toUser: { select: { id: true, displayName: true, email: true } },
      },
    });
    if (!delegation) {
      throw new NotFoundException('التفويض غير موجود');
    }
    return delegation;
  }

  /**
   * Create delegation with full validation
   */
  async create(currentUserId: string, dto: CreateDelegationDto) {
    // 1. Force fromUserId = current user (prevent spoofing)
    const fromUserId = currentUserId;
    const toUserId = dto.toUserId;

    if (fromUserId === toUserId) {
      throw new BadRequestException('لا يمكن التفويض لنفسك');
    }

    // 2. Validate toUser exists
    const toUser = await this.prisma.user.findUnique({ where: { id: toUserId } });
    if (!toUser) {
      throw new NotFoundException('المستخدم المفوض إليه غير موجود');
    }

    // 3. Validate dates
    const validFrom = new Date(dto.validFrom);
    const validUntil = new Date(dto.validUntil);
    if (validUntil <= validFrom) {
      throw new BadRequestException('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية');
    }

    // 4. Parse and validate scopeJson
    let scopeData: any;
    try {
      scopeData = JSON.parse(dto.scopeJson);
    } catch {
      throw new BadRequestException('بيانات النطاق غير صالحة');
    }

    // 5. Validate the user actually HAS what they're delegating
    await this.validateDelegationScope(fromUserId, dto.scopeType, scopeData);

    // 6. Create as ACTIVE directly (skip draft for simplicity)
    const delegation = await this.prisma.delegation.create({
      data: {
        state: DELEGATION_STATES.ACTIVE,
        fromUserId,
        toUserId,
        scopeType: dto.scopeType,
        scopeJson: dto.scopeJson,
        validFrom,
        validUntil,
        reason: dto.reason,
      },
      include: {
        fromUser: { select: { id: true, displayName: true, email: true } },
        toUser: { select: { id: true, displayName: true, email: true } },
      },
    });

    return delegation;
  }

  /**
   * Validate that the fromUser actually has the role/permissions they're delegating
   */
  private async validateDelegationScope(fromUserId: string, scopeType: string, scopeData: any) {
    if (scopeType === 'FULL_ROLE') {
      if (!scopeData.roleCode) {
        throw new BadRequestException('يجب تحديد رمز الدور للتفويض');
      }
      // Check the role exists
      const role = await this.prisma.role.findFirst({ where: { code: scopeData.roleCode } });
      if (!role) {
        throw new BadRequestException(`الدور "${scopeData.roleCode}" غير موجود`);
      }
      // Check the user actually has this role
      const userRole = await this.prisma.userRole.findFirst({
        where: {
          userId: fromUserId,
          role: { code: scopeData.roleCode },
          ...(scopeData.councilId ? { councilId: scopeData.councilId } : {}),
        },
      });
      if (!userRole) {
        throw new ForbiddenException('لا يمكنك تفويض دور لا تملكه');
      }
    } else if (scopeType === 'SPECIFIC_PERMISSION') {
      if (!Array.isArray(scopeData.permissionCodes) || scopeData.permissionCodes.length === 0) {
        throw new BadRequestException('يجب تحديد صلاحية واحدة على الأقل');
      }
      // Check all permissions exist
      const permissions = await this.prisma.permission.findMany({
        where: { code: { in: scopeData.permissionCodes } },
      });
      if (permissions.length !== scopeData.permissionCodes.length) {
        throw new BadRequestException('بعض الصلاحيات المحددة غير موجودة');
      }
      // Check the user has all these permissions through their roles
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId: fromUserId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      const userPermCodes = new Set<string>();
      for (const ur of userRoles) {
        for (const rp of ur.role.permissions) {
          userPermCodes.add(rp.permission.code);
        }
      }
      const missing = scopeData.permissionCodes.filter((c: string) => !userPermCodes.has(c));
      if (missing.length > 0) {
        throw new ForbiddenException(`لا يمكنك تفويض صلاحيات لا تملكها: ${missing.join(', ')}`);
      }
    } else if (scopeType === 'TOPIC_TYPE') {
      if (!scopeData.topicType) {
        throw new BadRequestException('يجب تحديد نوع الموضوع');
      }
    } else {
      throw new BadRequestException(`نوع التفويض "${scopeType}" غير مدعوم`);
    }
  }

  /**
   * Revoke — only the delegation owner or admin can revoke
   */
  async revoke(id: string, currentUserId: string, isAdmin: boolean) {
    const delegation = await this.findById(id);

    if (!isAdmin && delegation.fromUserId !== currentUserId) {
      throw new ForbiddenException('لا يمكنك إلغاء تفويض لست صاحبه');
    }

    if (delegation.state === DELEGATION_STATES.REVOKED) {
      throw new BadRequestException('التفويض ملغي بالفعل');
    }

    return this.prisma.delegation.update({
      where: { id },
      data: { state: DELEGATION_STATES.REVOKED },
      include: {
        fromUser: { select: { id: true, displayName: true, email: true } },
        toUser: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  async activate(id: string, currentUserId: string, isAdmin: boolean) {
    const delegation = await this.findById(id);

    if (!isAdmin && delegation.fromUserId !== currentUserId) {
      throw new ForbiddenException('لا يمكنك تفعيل تفويض لست صاحبه');
    }

    if (delegation.state !== DELEGATION_STATES.DRAFT && delegation.state !== DELEGATION_STATES.SUSPENDED) {
      throw new BadRequestException('لا يمكن تفعيل التفويض في حالته الحالية');
    }

    return this.prisma.delegation.update({
      where: { id },
      data: { state: DELEGATION_STATES.ACTIVE },
      include: {
        fromUser: { select: { id: true, displayName: true, email: true } },
        toUser: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  async suspend(id: string, currentUserId: string, isAdmin: boolean) {
    const delegation = await this.findById(id);

    if (!isAdmin && delegation.fromUserId !== currentUserId) {
      throw new ForbiddenException('لا يمكنك تعليق تفويض لست صاحبه');
    }

    if (delegation.state !== DELEGATION_STATES.ACTIVE) {
      throw new BadRequestException('لا يمكن تعليق تفويض غير نشط');
    }

    return this.prisma.delegation.update({
      where: { id },
      data: { state: DELEGATION_STATES.SUSPENDED },
      include: {
        fromUser: { select: { id: true, displayName: true, email: true } },
        toUser: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  async resume(id: string, currentUserId: string, isAdmin: boolean) {
    const delegation = await this.findById(id);

    if (!isAdmin && delegation.fromUserId !== currentUserId) {
      throw new ForbiddenException('لا يمكنك استئناف تفويض لست صاحبه');
    }

    if (delegation.state !== DELEGATION_STATES.SUSPENDED) {
      throw new BadRequestException('لا يمكن استئناف تفويض غير معلق');
    }

    return this.prisma.delegation.update({
      where: { id },
      data: { state: DELEGATION_STATES.ACTIVE },
      include: {
        fromUser: { select: { id: true, displayName: true, email: true } },
        toUser: { select: { id: true, displayName: true, email: true } },
      },
    });
  }
}
