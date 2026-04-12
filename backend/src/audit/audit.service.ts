import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.actorId) {
      where.OR = [
        { actorActualId: query.actorId },
        { actorDisplayId: query.actorId },
      ];
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actorActual: {
            select: { id: true, displayName: true, email: true },
          },
          actorDisplay: {
            select: { id: true, displayName: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
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

  async createLog(data: CreateAuditLogDto) {
    return this.prisma.auditLog.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        actorActualId: data.actorActualId,
        actorDisplayId: data.actorDisplayId,
        visibilityProfile: data.visibilityProfile ?? 'FULL_AUDIT',
        delegationId: data.delegationId,
        reason: data.reason,
        beforeJson: data.beforeJson,
        afterJson: data.afterJson,
        ipAddress: data.ipAddress,
      },
    });
  }
}
