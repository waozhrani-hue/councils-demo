import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class MeetingTransitionDto {
  @IsString()
  @IsNotEmpty()
  action: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
