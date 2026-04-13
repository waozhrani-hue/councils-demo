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
import { ExaminationsService } from './examinations.service';
import { CreateExaminationDto } from './dto/create-examination.dto';
import { ExaminationResultDto } from './dto/examination-result.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ExaminationsController {
  constructor(private readonly examinationsService: ExaminationsService) {}

  @Post('examinations')
  async create(
    @Body() dto: CreateExaminationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.examinationsService.create(dto, user.sub);
  }

  @Patch('examinations/:id/result')
  async updateResult(
    @Param('id') id: string,
    @Body() dto: ExaminationResultDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.examinationsService.updateResult(id, dto, user.sub);
  }

  @Get('councils/:councilId/examinations')
  async findByCouncil(@Param('councilId') councilId: string) {
    return this.examinationsService.findByCouncil(councilId);
  }
}
