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
import { MinutesService } from './minutes.service';
import { CreateMinutesDto } from './dto/create-minutes.dto';
import { UpdateMinutesDto } from './dto/update-minutes.dto';
import { MinutesTransitionDto } from './dto/minutes-transition.dto';
import { MinutesFeedbackDto } from './dto/minutes-feedback.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class MinutesController {
  constructor(private readonly minutesService: MinutesService) {}

  @Post('meetings/:meetingId/minutes')
  async create(
    @Param('meetingId') meetingId: string,
    @Body() dto: CreateMinutesDto,
  ) {
    return this.minutesService.create(meetingId, dto);
  }

  @Patch('minutes/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateMinutesDto) {
    return this.minutesService.update(id, dto);
  }

  @Post('minutes/:id/transition')
  async transition(
    @Param('id') id: string,
    @Body() dto: MinutesTransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.minutesService.transition(id, dto, user);
  }

  @Post('minutes/:id/feedback')
  async addFeedback(
    @Param('id') id: string,
    @Body() dto: MinutesFeedbackDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.minutesService.addFeedback(id, dto, user.sub);
  }

  @Get('minutes/:id')
  async findById(@Param('id') id: string) {
    return this.minutesService.findById(id);
  }
}
