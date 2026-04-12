import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouncilDto } from './dto/create-council.dto';
import { UpdateCouncilDto } from './dto/update-council.dto';

@Injectable()
export class CouncilsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.council.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const council = await this.prisma.council.findUnique({
      where: { id },
      include: {
        userRoles: { include: { user: true, role: true } },
      },
    });
    if (!council) {
      throw new NotFoundException(`Council ${id} not found`);
    }
    return council;
  }

  async create(dto: CreateCouncilDto) {
    const existing = await this.prisma.council.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Council code "${dto.code}" already exists`);
    }

    return this.prisma.council.create({
      data: {
        name: dto.name,
        code: dto.code,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCouncilDto) {
    await this.findById(id);

    if (dto.code) {
      const existing = await this.prisma.council.findFirst({
        where: { code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(
          `Council code "${dto.code}" already exists`,
        );
      }
    }

    return this.prisma.council.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        isActive: dto.isActive,
      },
    });
  }
}
