import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrgUnitDto } from './dto/create-org-unit.dto';
import { UpdateOrgUnitDto } from './dto/update-org-unit.dto';

@Injectable()
export class OrgUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.organizationUnit.findMany({
      orderBy: { name: 'asc' },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async findById(id: string) {
    const org = await this.prisma.organizationUnit.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        users: {
          select: {
            id: true,
            displayName: true,
            email: true,
            isActive: true,
          },
        },
      },
    });
    if (!org) {
      throw new NotFoundException(`OrganizationUnit ${id} not found`);
    }
    return org;
  }

  async create(dto: CreateOrgUnitDto) {
    if (dto.code) {
      const existing = await this.prisma.organizationUnit.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException(`Org code "${dto.code}" already exists`);
      }
    }

    if (dto.parentId) {
      const parent = await this.prisma.organizationUnit.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent org ${dto.parentId} not found`);
      }
    }

    return this.prisma.organizationUnit.create({
      data: {
        name: dto.name,
        code: dto.code,
        parentId: dto.parentId,
        isActive: dto.isActive ?? true,
      },
      include: { parent: true },
    });
  }

  async update(id: string, dto: UpdateOrgUnitDto) {
    await this.findById(id);

    if (dto.code) {
      const existing = await this.prisma.organizationUnit.findFirst({
        where: { code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`Org code "${dto.code}" already exists`);
      }
    }

    if (dto.parentId) {
      const parent = await this.prisma.organizationUnit.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent org ${dto.parentId} not found`);
      }
    }

    return this.prisma.organizationUnit.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        parentId: dto.parentId,
        isActive: dto.isActive,
      },
      include: { parent: true },
    });
  }
}
