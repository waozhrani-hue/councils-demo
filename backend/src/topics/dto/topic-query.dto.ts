import { IsString, IsOptional, IsNumberString } from 'class-validator';

export class TopicQueryDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsString()
  status?: string;

  /** Comma-separated list of statuses, e.g. "INBOX_GS,GS_REVIEW" */
  @IsOptional()
  @IsString()
  statuses?: string;

  @IsOptional()
  @IsString()
  councilId?: string;

  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  createdById?: string;
}
