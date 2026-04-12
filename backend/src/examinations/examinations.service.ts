import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExaminationDto } from './dto/create-examination.dto';
import { ExaminationResultDto } from './dto/examination-result.dto';

@Injectable()
export class ExaminationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExaminationDto, assignedById: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: dto.topicId },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    if (
      topic.status !== 'WITH_COUNCIL' &&
      topic.status !== 'EXAM_IN_PROGRESS'
    ) {
      throw new BadRequestException(
        'Topic must be in WITH_COUNCIL or EXAM_IN_PROGRESS status to assign examination',
      );
    }

    const examination = await this.prisma.examination.create({
      data: {
        topicId: dto.topicId,
        examinerId: dto.examinerId,
        assignedById,
        result: 'INCOMPLETE',
        version: topic.currentVersion,
      },
      include: {
        topic: true,
        examiner: {
          select: { id: true, displayName: true, email: true },
        },
        assignedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    // Transition topic to EXAM_IN_PROGRESS if it's WITH_COUNCIL
    if (topic.status === 'WITH_COUNCIL') {
      await this.prisma.topic.update({
        where: { id: dto.topicId },
        data: { status: 'EXAM_IN_PROGRESS' },
      });
    }

    return examination;
  }

  async updateResult(
    id: string,
    dto: ExaminationResultDto,
    examinerId: string,
  ) {
    const examination = await this.prisma.examination.findUnique({
      where: { id },
      include: { topic: true },
    });

    if (!examination) {
      throw new NotFoundException('Examination not found');
    }

    if (examination.topic.status !== 'EXAM_IN_PROGRESS') {
      throw new BadRequestException(
        'Topic must be in EXAM_IN_PROGRESS status',
      );
    }

    const updated = await this.prisma.examination.update({
      where: { id },
      data: {
        result: dto.result,
        reasons: dto.reasons,
      },
      include: {
        topic: true,
        examiner: {
          select: { id: true, displayName: true, email: true },
        },
        assignedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    // Transition topic based on result
    const newStatus =
      dto.result === 'COMPLETE' ? 'EXAM_COMPLETE' : 'EXAM_INCOMPLETE';

    await this.prisma.$transaction([
      this.prisma.topic.update({
        where: { id: examination.topicId },
        data: {
          status: newStatus,
          currentVersion: examination.topic.currentVersion + 1,
        },
      }),
      this.prisma.topicStatusLog.create({
        data: {
          topicId: examination.topicId,
          fromStatus: 'EXAM_IN_PROGRESS',
          toStatus: newStatus,
          action: dto.result === 'COMPLETE' ? 'EXAM_PASS' : 'EXAM_FAIL',
          actorId: examinerId,
          reason: dto.reasons,
          version: examination.topic.currentVersion + 1,
        },
      }),
    ]);

    return updated;
  }

  async findByCouncil(councilId: string) {
    return this.prisma.examination.findMany({
      where: {
        topic: {
          councilId,
          status: 'EXAM_IN_PROGRESS',
        },
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
        examiner: {
          select: { id: true, displayName: true, email: true },
        },
        assignedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
