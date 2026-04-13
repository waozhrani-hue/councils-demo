import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingTransitionDto } from './dto/meeting-transition.dto';
import { ReorderAgendaDto } from './dto/reorder-agenda.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post('councils/:councilId/meetings')
  async create(
    @Param('councilId') councilId: string,
    @Body() dto: CreateMeetingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.meetingsService.create(councilId, dto, user.sub);
  }

  @Get('meetings')
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.meetingsService.findAll(user);
  }

  @Get('councils/:councilId/meetings')
  async findByCouncil(@Param('councilId') councilId: string) {
    return this.meetingsService.findByCouncil(councilId);
  }

  @Get('meetings/:id')
  async findById(@Param('id') id: string) {
    return this.meetingsService.findById(id);
  }

  @Post('meetings/:id/transition')
  async transition(
    @Param('id') id: string,
    @Body() dto: MeetingTransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.meetingsService.transition(id, dto, user);
  }

  @Post('meetings/:id/topics/:topicId/withdraw')
  async withdrawTopic(
    @Param('id') id: string,
    @Param('topicId') topicId: string,
  ) {
    return this.meetingsService.withdrawTopic(id, topicId);
  }

  @Patch('meetings/:id/topics/:topicId/defer')
  async deferTopic(
    @Param('id') id: string,
    @Param('topicId') topicId: string,
  ) {
    return this.meetingsService.deferTopic(id, topicId);
  }

  @Get('councils/:councilId/agenda-box')
  async getAgendaBox(@Param('councilId') councilId: string) {
    return this.meetingsService.getAgendaBox(councilId);
  }

  @Patch('councils/:councilId/agenda-box/reorder')
  async reorderAgendaBox(
    @Param('councilId') councilId: string,
    @Body() dto: ReorderAgendaDto,
  ) {
    return this.meetingsService.reorderAgendaBox(councilId, dto.orderedTopicIds);
  }
}
