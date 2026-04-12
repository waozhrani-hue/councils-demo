import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDecisionDto {
  @IsString()
  @IsNotEmpty()
  topicId: string;

  @IsString()
  @IsOptional()
  summary?: string;
}
