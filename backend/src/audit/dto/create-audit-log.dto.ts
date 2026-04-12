import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAuditLogDto {
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @IsString()
  @IsNotEmpty()
  entityId: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @IsString()
  @IsNotEmpty()
  actorActualId: string;

  @IsString()
  @IsNotEmpty()
  actorDisplayId: string;

  @IsOptional()
  @IsString()
  visibilityProfile?: string;

  @IsOptional()
  @IsString()
  delegationId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  beforeJson?: string;

  @IsOptional()
  @IsString()
  afterJson?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
