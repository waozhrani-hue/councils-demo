import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
  IsDateString,
} from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  topicIds?: string[];
}
