import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { TeamService } from './team.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Controller('team')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('members')
  getMyTeam(@CurrentUser() user: JwtPayload) {
    return this.teamService.getTeamMembers(user);
  }

  @Get('assignable-roles')
  getAssignableRoles(@CurrentUser() user: JwtPayload) {
    return this.teamService.getAssignableRoles(user);
  }

  @Get('org-tree')
  getMyOrgTree(@CurrentUser() user: JwtPayload) {
    return this.teamService.getMyOrgTree(user);
  }

  @Post('members')
  createMember(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateUserDto & { roleCode?: string; roleId?: string; councilId?: string },
  ) {
    return this.teamService.createTeamMember(user, dto);
  }

  @Post('sub-units')
  createSubUnit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { name: string; code?: string; unitType?: string; parentId?: string },
  ) {
    return this.teamService.createSubUnit(user, dto);
  }

  @Post('members/:userId/roles')
  assignRole(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto & { roleCode?: string },
  ) {
    return this.teamService.assignTeamRole(user, userId, dto);
  }

  @Delete('members/:userId/roles/:userRoleId')
  removeRole(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Param('userRoleId') userRoleId: string,
  ) {
    return this.teamService.removeTeamRole(user, userId, userRoleId);
  }
}
