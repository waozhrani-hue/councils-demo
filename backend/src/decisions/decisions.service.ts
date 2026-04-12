import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Injectable()
export class DecisionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(minutesId: string, dto: CreateDecisionDto) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { id: minutesId },
    });

    if (!minutes) {
      throw new NotFoundException('Minutes not found');
    }

    // Verify topic exists
    const topic = await this.prisma.topic.findUnique({
      where: { id: dto.topicId },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.decision.count({
      where: { refNumber: { startsWith: `DEC-${year}-` } },
    });
    const refNumber = `DEC-${year}-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.decision.create({
      data: {
        refNumber,
        topicId: dto.topicId,
        minutesId,
        status: 'DEC_DRAFT',
        summary: dto.summary,
      },
      include: {
        topic: {
          select: {
            id: true,
            refNumber: true,
            title: true,
            status: true,
          },
        },
        minutes: {
          select: { id: true, status: true },
        },
      },
    });
  }

  async issue(id: string, userId: string) {
    const decision = await this.prisma.decision.findUnique({
      where: { id },
      include: { minutes: true },
    });

    if (!decision) {
      throw new NotFoundException('Decision not found');
    }

    if (decision.status !== 'DEC_DRAFT') {
      throw new BadRequestException('Decision is not in DEC_DRAFT status');
    }

    if (!decision.minutes || decision.minutes.status !== 'MIN_SIGNED') {
      throw new BadRequestException(
        'Minutes must be in MIN_SIGNED status to issue a decision',
      );
    }

    const updated = await this.prisma.decision.update({
      where: { id },
      data: {
        status: 'DEC_ISSUED',
        issuedAt: new Date(),
        issuedById: userId,
      },
      include: {
        topic: {
          select: {
            id: true,
            refNumber: true,
            title: true,
            status: true,
          },
        },
        minutes: {
          select: { id: true, status: true },
        },
        issuedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    // Update topic status to DECISION_ISSUED
    await this.prisma.topic.update({
      where: { id: decision.topicId },
      data: { status: 'DECISION_ISSUED' },
    });

    return updated;
  }

  async findAll(user: JwtPayload) {
    const roles = user.roles ?? [];
    const roleCodes = roles.map((r) => r.code);

    const where: Record<string, unknown> = {};

    const isAdmin = roleCodes.includes('SYSTEM_ADMIN');
    const isGS = roleCodes.includes('GENERAL_SECRETARY');
    const isGSStaff = roleCodes.includes('GS_OFFICE_STAFF');

    if (!isAdmin && !isGS && !isGSStaff) {
      // Council-scoped roles see decisions for their councils
      const councilIds = roles
        .filter(
          (r) =>
            ['COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT', 'COUNCIL_MEMBER', 'EXAM_OFFICER'].includes(r.code) &&
            r.councilId,
        )
        .map((r) => r.councilId!);

      if (councilIds.length > 0) {
        where.topic = { councilId: { in: councilIds } };
      } else {
        // No council roles — return empty
        where.topic = { councilId: '__none__' };
      }
    }

    return this.prisma.decision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        topic: {
          select: {
            id: true,
            refNumber: true,
            title: true,
            status: true,
            council: { select: { id: true, name: true } },
          },
        },
        minutes: {
          select: { id: true, status: true },
        },
        issuedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
  }

  async findById(id: string) {
    const decision = await this.prisma.decision.findUnique({
      where: { id },
      include: {
        topic: {
          include: {
            council: true,
            secrecyLevel: true,
            requestingOrg: true,
          },
        },
        minutes: {
          include: {
            meeting: true,
          },
        },
        issuedBy: {
          select: { id: true, displayName: true, email: true },
        },
        notifications: true,
      },
    });

    if (!decision) {
      throw new NotFoundException('Decision not found');
    }

    return decision;
  }
}
