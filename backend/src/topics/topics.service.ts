import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { TopicQueryDto } from './dto/topic-query.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DynamicPermissionService } from '../auth/dynamic-permission.service';

@Injectable()
export class TopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: DynamicPermissionService,
  ) {}

  async create(dto: CreateTopicDto, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user || !user.organizationId) {
      throw new BadRequestException(
        'User must belong to an organization to create a topic',
      );
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.topic.count({
      where: {
        refNumber: { startsWith: `TOP-${year}-` },
      },
    });
    const refNumber = `TOP-${year}-${String(count + 1).padStart(5, '0')}`;

    const topic = await this.prisma.topic.create({
      data: {
        refNumber,
        title: dto.title,
        body: dto.body,
        status: 'DRAFT',
        councilId: dto.councilId,
        secrecyLevelId: dto.secrecyLevelId || undefined,
        requestingOrgId: user.organizationId,
        createdById: userId,
      },
      include: {
        council: true,
        secrecyLevel: true,
        requestingOrg: true,
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    // إنشاء سجل الحالة الأولي
    await this.prisma.topicStatusLog.create({
      data: {
        topicId: topic.id,
        fromStatus: null,
        toStatus: 'DRAFT',
        action: 'CREATE',
        actorId: userId,
        version: 1,
      },
    });

    // إذا طلب الإرسال مباشرة → نقل الحالة إلى PENDING_DEPT_MGR
    if (dto.submit) {
      const updated = await this.prisma.topic.update({
        where: { id: topic.id },
        data: { status: 'PENDING_DEPT_MGR' },
        include: {
          council: true,
          secrecyLevel: true,
          requestingOrg: true,
          createdBy: {
            select: { id: true, displayName: true, email: true },
          },
        },
      });

      await this.prisma.topicStatusLog.create({
        data: {
          topicId: topic.id,
          fromStatus: 'DRAFT',
          toStatus: 'PENDING_DEPT_MGR',
          action: 'SUBMIT_TO_MANAGER',
          actorId: userId,
          version: 1,
        },
      });

      return updated;
    }

    return topic;
  }

  async findAll(query: TopicQueryDto, user: JwtPayload) {
    const page = parseInt(query.page ?? '1', 10);
    const limit = parseInt(query.limit ?? '20', 10);
    const skip = (page - 1) * limit;

    // Build WHERE using AND array to avoid OR conflicts
    const andConditions: any[] = [];

    // ── Status filters ──
    if (query.status) {
      andConditions.push({ status: query.status });
    }
    if (query.statuses) {
      const statusList = query.statuses.split(',').map((s) => s.trim()).filter(Boolean);
      if (statusList.length > 0) {
        andConditions.push({ status: { in: statusList } });
      }
    }

    if (query.councilId) {
      andConditions.push({ councilId: query.councilId });
    }
    if (query.orgId) {
      andConditions.push({ requestingOrgId: query.orgId });
    }
    if (query.createdById) {
      andConditions.push({ createdById: query.createdById });
    }
    if (query.search) {
      andConditions.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { refNumber: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    // ── Clearance filtering ──
    // Topics without a secrecy level are visible to everyone.
    // Topics WITH a secrecy level require user clearance >= topic level.
    if (user.clearanceLevel !== undefined) {
      andConditions.push({
        OR: [
          { secrecyLevelId: null },
          { secrecyLevel: { sortOrder: { lte: user.clearanceLevel } } },
        ],
      });
    }

    // ── Permission-based auto-scoping ──
    const permissions = await this.permissionService.getUserPermissions(user.sub);
    const userRoles = await this.permissionService.getUserRoles(user.sub);

    const canViewAll = permissions.includes('VIEW_ALL_TOPICS');

    if (!canViewAll) {
      const scopeConditions: any[] = [];

      // Council-scoped roles see topics for their councils
      const councilIds = userRoles
        .filter((r) => r.scope === 'COUNCIL' && r.councilId)
        .map((r) => r.councilId!);

      if (councilIds.length > 0 && !query.councilId) {
        scopeConditions.push({ councilId: { in: councilIds } });
      }

      // Users with APPROVE_TOPIC see topics from their org and below
      if (permissions.includes('APPROVE_TOPIC')) {
        const dbUser = await this.prisma.user.findUnique({
          where: { id: user.sub },
          select: { organizationId: true },
        });
        if (dbUser?.organizationId && !query.orgId) {
          scopeConditions.push({ requestingOrgId: dbUser.organizationId });
        }
      }

      // Users with only VIEW_TOPICS permission see their own topics
      if (permissions.includes('VIEW_TOPICS')) {
        scopeConditions.push({ createdById: user.sub });
      }

      if (scopeConditions.length > 0) {
        andConditions.push({ OR: scopeConditions });
      } else {
        // No qualifying permission — own topics only
        andConditions.push({ createdById: user.sub });
      }
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const [data, total] = await Promise.all([
      this.prisma.topic.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          council: true,
          secrecyLevel: true,
          requestingOrg: true,
          createdBy: {
            select: { id: true, displayName: true, email: true },
          },
        },
      }),
      this.prisma.topic.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        council: true,
        secrecyLevel: true,
        requestingOrg: true,
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        attachments: true,
        statusLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
        examinations: {
          include: {
            examiner: {
              select: { id: true, displayName: true, email: true },
            },
            assignedBy: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    return topic;
  }

  async update(id: string, dto: UpdateTopicDto) {
    const topic = await this.prisma.topic.findUnique({ where: { id } });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    if (topic.status !== 'DRAFT') {
      throw new BadRequestException('Topic can only be updated in DRAFT status');
    }

    return this.prisma.topic.update({
      where: { id },
      data: dto,
      include: {
        council: true,
        secrecyLevel: true,
        requestingOrg: true,
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
  }

  async getStatusLogs(topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    return this.prisma.topicStatusLog.findMany({
      where: { topicId },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
  }
}
