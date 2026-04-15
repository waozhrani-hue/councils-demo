import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDelegationDto {
  @IsString()
  @IsNotEmpty()
  toUserId: string;

  @IsString()
  @IsIn(['FULL_ROLE', 'SPECIFIC_PERMISSION', 'TOPIC_TYPE'])
  scopeType: string;

  @IsString()
  @IsNotEmpty()
  scopeJson: string;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  validUntil: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
