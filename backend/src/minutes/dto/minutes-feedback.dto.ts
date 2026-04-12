import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class MinutesFeedbackDto {
  @IsBoolean()
  @IsOptional()
  approved?: boolean;

  @IsString()
  @IsOptional()
  comment?: string;
}
