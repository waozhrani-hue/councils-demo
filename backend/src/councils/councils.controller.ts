import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CouncilsService } from './councils.service';
import { CreateCouncilDto } from './dto/create-council.dto';
import { UpdateCouncilDto } from './dto/update-council.dto';

@Controller('councils')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CouncilsController {
  constructor(private readonly councilsService: CouncilsService) {}

  @Get()
  findAll() {
    return this.councilsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.councilsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateCouncilDto) {
    return this.councilsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCouncilDto) {
    return this.councilsService.update(id, dto);
  }
}
