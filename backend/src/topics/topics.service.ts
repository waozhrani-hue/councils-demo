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

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const where: Record<string, unknown> = {};

    // ── Status filters ──
    if (query.status) {
      where.status = query.status;
    }
    if (query.statuses) {
      const statusList = query.statuses.split(',').map((s) => s.trim()).filter(Boolean);
      if (statusList.length > 0) {
        where.status = { in: statusList };
      }
    }

    if (query.councilId) {
      where.councilId = query.councilId;
    }
    if (query.orgId) {
      where.requestingOrgId = query.orgId;
    }
    if (query.createdById) {
      where.createdById = query.createdById;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { refNumber: { contains: query.search } },
      ];
    }

    // ── Clearance filtering ──
    if (user.clearanceLevel !== undefined) {
      where.secrecyLevel = {
        sortOrder: { lte: user.clearanceLevel },
      };
    }

    // ── Role-based auto-scoping (when no explicit filters override) ──
    const roles = user.roles ?? [];
    const roleCodes = roles.map((r) => r.code);

    // SYSTEM_ADMIN and GENERAL_SECRETARY see everything
    const isAdmin = roleCodes.includes('SYSTEM_ADMIN');
    const isGS = roleCodes.includes('GENERAL_SECRETARY');
    const isGSStaff = roleCodes.includes('GS_OFFICE_STAFF');

    if (!isAdmin && !isGS && !isGSStaff) {
      // Build council-scoped and org-scoped OR conditions
      const scopeConditions: any[] = [];

      // Council-scoped roles see topics for their councils
      const councilIds = roles
        .filter((r) =>
          ['COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT', 'COUNCIL_MEMBER', 'EXAM_OFFICER'].includes(r.code) &&
          r.councilId,
        )
        .map((r) => r.councilId!);

      if (councilIds.length > 0 && !query.councilId) {
        scopeConditions.push({ councilId: { in: councilIds } });
      }

      // DEPT_MANAGER sees topics from their org
      if (roleCodes.includes('DEPT_MANAGER')) {
        const dbUser = await this.prisma.user.findUnique({
          where: { id: user.sub },
          select: { organizationId: true },
        });
        if (dbUser?.organizationId && !query.orgId) {
          scopeConditions.push({ requestingOrgId: dbUser.organizationId });
        }
      }

      // DEPT_STAFF sees only their own topics
      if (roleCodes.includes('DEPT_STAFF') && !roleCodes.includes('DEPT_MANAGER')) {
        scopeConditions.push({ createdById: user.sub });
      }

      // Apply scope: if user has multiple roles, OR them together
      if (scopeConditions.length === 1) {
        Object.assign(where, scopeConditions[0]);
      } else if (scopeConditions.length > 1) {
        // Merge with any existing OR (search)
        const existingOR = where.OR;
        delete where.OR;
        where.AND = [
          { OR: scopeConditions },
          ...(existingOR ? [{ OR: existingOR as any }] : []),
        ];
      } else if (scopeConditions.length === 0) {
        // User has no qualifying role — show only own topics
        where.createdById = user.sub;
      }
    }

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
