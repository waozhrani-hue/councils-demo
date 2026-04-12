import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    orgId?: string;
    roleCode?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { displayName: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }

    if (query.orgId) {
      where.organizationId = query.orgId;
    }

    if (query.roleCode) {
      where.roles = {
        some: {
          role: { code: query.roleCode },
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: { include: { role: true, council: true } },
          organization: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map(({ passwordHash, ...rest }: any) => rest),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true, council: true } },
        organization: true,
        maxClearance: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        organizationId: dto.organizationId,
        maxClearanceId: dto.maxClearanceId,
      },
      include: {
        roles: { include: { role: true } },
        organization: true,
      },
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        displayName: dto.displayName,
        organizationId: dto.organizationId,
        maxClearanceId: dto.maxClearanceId,
        isActive: dto.isActive,
      },
      include: {
        roles: { include: { role: true } },
        organization: true,
      },
    });

    const { passwordHash, ...result } = user;
    return result;
  }

  async assignRole(userId: string, roleId: string, councilId?: string) {
    await this.findById(userId);

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    if (councilId) {
      const council = await this.prisma.council.findUnique({
        where: { id: councilId },
      });
      if (!council) {
        throw new NotFoundException(`Council ${councilId} not found`);
      }
    }

    const existing = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId_councilId: {
          userId,
          roleId,
          councilId: councilId ?? '',
        },
      },
    });
    if (existing) {
      throw new ConflictException('User already has this role');
    }

    return this.prisma.userRole.create({
      data: { userId, roleId, councilId },
      include: { role: true, council: true },
    });
  }

  async removeRole(userRoleId: string) {
    const userRole = await this.prisma.userRole.findUnique({
      where: { id: userRoleId },
    });
    if (!userRole) {
      throw new NotFoundException(`UserRole ${userRoleId} not found`);
    }

    return this.prisma.userRole.delete({ where: { id: userRoleId } });
  }
}
