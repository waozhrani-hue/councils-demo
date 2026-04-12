import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateOrgUnitDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
