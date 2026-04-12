import {
  BadRequestException,
  ConflictException,
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

  async findAll(query: { userId?: string; state?: string }) {
    const where: any = {};

    if (query.userId) {
      where.OR = [
        { fromUserId: query.userId },
        { toUserId: query.userId },
      ];
    }

    if (query.state) {
      where.state = query.state;
    }

    return this.prisma.delegation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        fromUser: {
          select: { id: true, displayName: true, email: true },
        },
        toUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
  }

  async findById(id: string) {
    const delegation = await this.prisma.delegation.findUnique({
      where: { id },
      include: {
        fromUser: {
          select: { id: true, displayName: true, email: true },
        },
        toUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
    if (!delegation) {
      throw new NotFoundException(`Delegation ${id} not found`);
    }
    return delegation;
  }

  async create(dto: CreateDelegationDto) {
    // Validate users exist
    const [fromUser, toUser] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.fromUserId } }),
      this.prisma.user.findUnique({ where: { id: dto.toUserId } }),
    ]);

    if (!fromUser) {
      throw new NotFoundException(`User ${dto.fromUserId} not found`);
    }
    if (!toUser) {
      throw new NotFoundException(`User ${dto.toUserId} not found`);
    }

    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Cannot delegate to self');
    }

    return this.prisma.delegation.create({
      data: {
        state: DELEGATION_STATES.DRAFT,
        fromUserId: dto.fromUserId,
        toUserId: dto.toUserId,
        scopeType: dto.scopeType,
        scopeJson: dto.scopeJson,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        reason: dto.reason,
      },
      include: {
        fromUser: {
          select: { id: true, displayName: true, email: true },
        },
        toUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
  }

  async activate(id: string) {
    const delegation = await this.findById(id);

    if (delegation.state !== DELEGATION_STATES.DRAFT) {
      throw new BadRequestException(
        `Cannot activate delegation in state "${delegation.state}". Must be "${DELEGATION_STATES.DRAFT}"`,
      );
    }

    // Check no other active delegation with same scope for same fromUser
    await this.validateNoActiveDuplicate(delegation);

    return this.prisma.delegation.update({
      where: { id },
      data: { state: DELEGATION_STATES.ACTIVE },
      include: {
        fromUser: {
          select: { id: true, displayName: true, email: true },
        },
        toUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
  }

  async revoke(id: string) {
    const delegation = await this.findById(id);

    if (
      delegation.state !== DELEGATION_STATES.ACTIVE &&
      delegation.state !== DELEGATION_STATES.SUSPENDED &&
      delegation.state !== DELEGATION_STATES.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot revoke delegation in state "${delegation.state}"`,
      );
    }

    return this.prisma.delegation.update({
      where: { id },
      data: { state: DELEGATION_STATES.REVOKED },
      include: {
        fromUser: {
          select: { id: true, displayName: true, email: true },
        },
        toUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
  }

  async suspend(id: string) {
    const delegation = await this.findById(id);

    if (delegation.state !== DELEGATION_STATES.ACTIVE) {
      throw new BadRequestException(
        `Cannot suspend delegation in state "${delegation.state}". Must be "${DELEGATION_STATES.ACTIVE}"`,
      );
    }

    return this.prisma.delegation.update({
      where: { id },
      data: { state: DELEGATION_STATES.SUSPENDED },
      include: {
        fromUser: {
          select: { id: true, displayName: true, email: true },
        },
        toUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
  }

  async resume(id: string) {
    const delegation = await this.findById(id);

    if (delegation.state !== DELEGATION_STATES.SUSPENDED) {
      throw new BadRequestException(
        `Cannot resume delegation in state "${delegation.state}". Must be "${DELEGATION_STATES.SUSPENDED}"`,
      );
    }

    // Check no other active delegation with same scope
    await this.validateNoActiveDuplicate(delegation);

    return this.prisma.delegation.update({
      where: { id },
      data: { state: DELEGATION_STATES.ACTIVE },
      include: {
        fromUser: {
          select: { id: true, displayName: true, email: true },
        },
        toUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
  }

  private async validateNoActiveDuplicate(delegation: {
    id: string;
    fromUserId: string;
    scopeType: string;
    scopeJson: string;
  }) {
    const existing = await this.prisma.delegation.findFirst({
      where: {
        id: { not: delegation.id },
        fromUserId: delegation.fromUserId,
        scopeType: delegation.scopeType,
        scopeJson: delegation.scopeJson,
        state: DELEGATION_STATES.ACTIVE,
      },
    });

    if (existing) {
      throw new ConflictException(
        'An active delegation with the same scope already exists for this user',
      );
    }
  }
}
