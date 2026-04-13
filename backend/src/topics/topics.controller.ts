import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { TopicsService } from './topics.service';
import { TopicsWorkflowService } from './topics-workflow.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { TransitionDto } from './dto/transition.dto';
import { TopicQueryDto } from './dto/topic-query.dto';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'topics');

@Controller('topics')
@UseGuards(JwtAuthGuard)
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
    private readonly workflowService: TopicsWorkflowService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@Body() dto: CreateTopicDto, @CurrentUser() user: JwtPayload) {
    return this.topicsService.create(dto, user.sub);
  }

  @Get()
  async findAll(@Query() query: TopicQueryDto, @CurrentUser() user: JwtPayload) {
    return this.topicsService.findAll(query, user);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.topicsService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTopicDto) {
    return this.topicsService.update(id, dto);
  }

  @Post(':id/transition')
  async transition(
    @Param('id') id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workflowService.transition(id, dto, user);
  }

  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    }),
  )
  async uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    const topic = await this.prisma.topic.findUnique({ where: { id } });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    return this.prisma.topicAttachment.create({
      data: {
        topicId: id,
        fileKey: file.filename,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedById: user.sub,
      },
    });
  }

  @Get(':id/attachments/:attId/download')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attId') attId: string,
    @Res() res: Response,
  ) {
    const attachment = await this.prisma.topicAttachment.findFirst({
      where: { id: attId, topicId: id },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const filePath = join(UPLOAD_DIR, attachment.fileKey);
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    res.download(filePath, attachment.fileName);
  }

  @Delete(':id/attachments/:attId')
  async deleteAttachment(
    @Param('id') id: string,
    @Param('attId') attId: string,
  ) {
    const topic = await this.prisma.topic.findUnique({ where: { id } });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    if (topic.status !== 'DRAFT') {
      throw new NotFoundException(
        'Attachments can only be deleted in DRAFT status',
      );
    }

    const attachment = await this.prisma.topicAttachment.findFirst({
      where: { id: attId, topicId: id },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.prisma.topicAttachment.delete({ where: { id: attId } });

    return { deleted: true };
  }
}
