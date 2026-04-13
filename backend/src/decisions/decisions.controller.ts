import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DecisionsService } from './decisions.service';
import { CreateDecisionDto } from './dto/create-decision.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Post('minutes/:minutesId/decisions')
  async create(
    @Param('minutesId') minutesId: string,
    @Body() dto: CreateDecisionDto,
  ) {
    return this.decisionsService.create(minutesId, dto);
  }

  @Post('decisions/:id/issue')
  async issue(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.decisionsService.issue(id, user.sub);
  }

  @Get('decisions')
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.decisionsService.findAll(user);
  }

  @Get('decisions/:id')
  async findById(@Param('id') id: string) {
    return this.decisionsService.findById(id);
  }
}
