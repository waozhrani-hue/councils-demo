import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateConfigDto {
  @IsString()
  @IsNotEmpty()
  value: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
