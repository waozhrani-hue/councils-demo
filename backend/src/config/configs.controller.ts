import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ConfigsService } from './configs.service';
import { UpdateConfigDto } from './dto/update-config.dto';

@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SYSTEM_ADMIN')
export class ConfigsController {
  constructor(private readonly configsService: ConfigsService) {}

  @Get()
  findAll() {
    return this.configsService.findAll();
  }

  @Get(':key')
  findByKey(@Param('key') key: string) {
    return this.configsService.findByKey(key);
  }

  @Patch(':key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.configsService.updateByKey(key, dto.value, dto.reason, user.sub);
  }
}
