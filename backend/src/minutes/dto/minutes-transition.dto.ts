import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class MinutesTransitionDto {
  @IsString()
  @IsNotEmpty()
  action: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
