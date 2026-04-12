import { IsString, IsOptional } from 'class-validator';

export class CreateMinutesDto {
  @IsString()
  @IsOptional()
  body?: string;
}
