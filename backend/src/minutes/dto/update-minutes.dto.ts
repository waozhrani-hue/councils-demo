import { IsString, IsOptional } from 'class-validator';

export class UpdateMinutesDto {
  @IsString()
  @IsOptional()
  body?: string;
}
