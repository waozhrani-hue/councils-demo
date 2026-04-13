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
import { NotificationsService } from './notifications.service';
import { ManualResolveDto } from './dto/manual-resolve.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  async findMyNotifications(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.findMyNotifications(user.sub);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Post(':id/deliver')
  async deliver(@Param('id') id: string) {
    return this.notificationsService.deliver(id);
  }

  @Post(':id/manual-resolve')
  async manualResolve(
    @Param('id') id: string,
    @Body() dto: ManualResolveDto,
  ) {
    return this.notificationsService.manualResolve(id, dto.reason);
  }
}
