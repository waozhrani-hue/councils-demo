import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { TeamService } from './team.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

/**
 * إدارة الفريق الهرمية:
 * - أمين المجلس → إضافة عضو مجلس + موظف مجلس (لمجلسه فقط)
 * - مدير الإدارة → إضافة موظف إدارة (لإدارته فقط)
 * - الأمين العام → إضافة موظف مكتب الأمين
 */
@Controller('team')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  'COUNCIL_SECRETARY',
  'DEPT_MANAGER',
  'GENERAL_SECRETARY',
  'SYSTEM_ADMIN',
)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /** قائمة أعضاء الفريق حسب دور المستخدم الحالي */
  @Get('members')
  getMyTeam(@CurrentUser() user: JwtPayload) {
    return this.teamService.getTeamMembers(user);
  }

  /** الأدوار التي يمكن للمستخدم الحالي تعيينها */
  @Get('assignable-roles')
  getAssignableRoles(@CurrentUser() user: JwtPayload) {
    return this.teamService.getAssignableRoles(user);
  }

  /** إنشاء مستخدم جديد ضمن نطاق صلاحيات المدير */
  @Post('members')
  createMember(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateUserDto & { roleCode: string; councilId?: string },
  ) {
    return this.teamService.createTeamMember(user, dto);
  }

  /** تعيين دور لمستخدم موجود ضمن نطاق الصلاحيات */
  @Post('members/:userId/roles')
  assignRole(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto & { roleCode?: string },
  ) {
    return this.teamService.assignTeamRole(user, userId, dto);
  }

  /** إزالة دور من عضو فريق */
  @Delete('members/:userId/roles/:userRoleId')
  removeRole(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Param('userRoleId') userRoleId: string,
  ) {
    return this.teamService.removeTeamRole(user, userId, userRoleId);
  }
}
