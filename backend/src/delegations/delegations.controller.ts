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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DelegationsService } from './delegations.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';

@Controller('delegations')
@UseGuards(JwtAuthGuard)
export class DelegationsController {
  constructor(private readonly delegationsService: DelegationsService) {}

  private isAdmin(user: JwtPayload): boolean {
    return user.roles?.some((r) => r.code === 'SYSTEM_ADMIN') ?? false;
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('state') state?: string,
  ) {
    return this.delegationsService.findAll(user.sub, this.isAdmin(user), { state });
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDelegationDto,
  ) {
    return this.delegationsService.create(user.sub, dto);
  }

  @Patch(':id/activate')
  activate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.delegationsService.activate(id, user.sub, this.isAdmin(user));
  }

  @Patch(':id/revoke')
  revoke(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.delegationsService.revoke(id, user.sub, this.isAdmin(user));
  }

  @Patch(':id/suspend')
  suspend(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.delegationsService.suspend(id, user.sub, this.isAdmin(user));
  }

  @Patch(':id/resume')
  resume(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.delegationsService.resume(id, user.sub, this.isAdmin(user));
  }
}
