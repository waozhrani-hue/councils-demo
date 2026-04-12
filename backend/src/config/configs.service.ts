import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConfigsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
      include: { updatedBy: { select: { id: true, displayName: true } } },
    });
  }

  async findByKey(key: string) {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
      include: { updatedBy: { select: { id: true, displayName: true } } },
    });
    if (!config) {
      throw new NotFoundException(`Config key "${key}" not found`);
    }
    return config;
  }

  async updateByKey(
    key: string,
    value: string,
    reason?: string,
    actorId?: string,
  ) {
    const config = await this.findByKey(key);
    const beforeValue = config.value;

    const updated = await this.prisma.systemConfig.update({
      where: { key },
      data: {
        value,
        updatedById: actorId,
      },
    });

    // Create audit log entry for the config change
    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'SystemConfig',
          entityId: config.id,
          action: 'UPDATE_CONFIG',
          actorActualId: actorId,
          actorDisplayId: actorId,
          reason,
          beforeJson: JSON.stringify({ key, value: beforeValue }),
          afterJson: JSON.stringify({ key, value }),
        },
      });
    }

    return updated;
  }

  async getConfigValue(key: string): Promise<string | number | boolean | any> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });
    if (!config) {
      return null;
    }

    switch (config.valueType) {
      case 'INT':
        return parseInt(config.value, 10);
      case 'BOOLEAN':
        return config.value === 'true';
      case 'JSON':
        try {
          return JSON.parse(config.value);
        } catch {
          return config.value;
        }
      case 'STRING':
      default:
        return config.value;
    }
  }
}
