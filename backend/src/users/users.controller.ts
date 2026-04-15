import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private assertAdmin(user: JwtPayload) {
    const isAdmin = user.roles?.some((r) => r.code === 'SYSTEM_ADMIN') ?? false;
    if (!isAdmin) {
      throw new ForbiddenException('هذا الإجراء متاح فقط لمدير النظام');
    }
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('orgId') orgId?: string,
    @Query('roleCode') roleCode?: string,
  ) {
    this.assertAdmin(user);
    return this.usersService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: (pageSize || limit) ? parseInt(pageSize || limit || '20', 10) : undefined,
      search,
      orgId,
      roleCode,
    });
  }

  @Get(':id')
  findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    this.assertAdmin(user);
    return this.usersService.findById(id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateUserDto) {
    this.assertAdmin(user);
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    this.assertAdmin(user);
    return this.usersService.update(id, dto);
  }

  @Post(':id/roles')
  assignRole(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AssignRoleDto) {
    this.assertAdmin(user);
    return this.usersService.assignRole(id, dto.roleId, dto.councilId);
  }

  @Delete('roles/:userRoleId')
  removeRole(@CurrentUser() user: JwtPayload, @Param('userRoleId') userRoleId: string) {
    this.assertAdmin(user);
    return this.usersService.removeRole(userRoleId);
  }

  /** اعتماد/تفعيل مستخدم — فقط مدير النظام */
  @Patch(':id/activate')
  activate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    this.assertAdmin(user);
    return this.usersService.setActive(id, true);
  }

  /** تعطيل مستخدم — فقط مدير النظام */
  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    this.assertAdmin(user);
    return this.usersService.setActive(id, false);
  }
}
