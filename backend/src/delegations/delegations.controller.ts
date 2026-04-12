import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DelegationsService } from './delegations.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';

@Controller('delegations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DelegationsController {
  constructor(private readonly delegationsService: DelegationsService) {}

  @Get()
  findAll(
    @Query('userId') userId?: string,
    @Query('state') state?: string,
  ) {
    return this.delegationsService.findAll({ userId, state });
  }

  @Post()
  create(@Body() dto: CreateDelegationDto) {
    return this.delegationsService.create(dto);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.delegationsService.activate(id);
  }

  @Patch(':id/revoke')
  revoke(@Param('id') id: string) {
    return this.delegationsService.revoke(id);
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.delegationsService.suspend(id);
  }

  @Patch(':id/resume')
  resume(@Param('id') id: string) {
    return this.delegationsService.resume(id);
  }
}
