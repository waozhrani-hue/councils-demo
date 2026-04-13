import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgUnitsService } from './org-units.service';
import { CreateOrgUnitDto } from './dto/create-org-unit.dto';
import { UpdateOrgUnitDto } from './dto/update-org-unit.dto';

@Controller('org-units')
@UseGuards(JwtAuthGuard)
export class OrgUnitsController {
  constructor(private readonly orgUnitsService: OrgUnitsService) {}

  @Get()
  findAll() {
    return this.orgUnitsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.orgUnitsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateOrgUnitDto) {
    return this.orgUnitsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrgUnitDto) {
    return this.orgUnitsService.update(id, dto);
  }
}
