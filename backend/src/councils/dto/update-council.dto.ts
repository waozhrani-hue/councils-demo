import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCouncilDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
