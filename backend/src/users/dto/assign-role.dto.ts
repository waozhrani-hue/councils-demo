import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  @IsNotEmpty()
  roleId: string;

  @IsOptional()
  @IsString()
  councilId?: string;
}
