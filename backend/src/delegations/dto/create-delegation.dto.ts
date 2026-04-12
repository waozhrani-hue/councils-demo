import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDelegationDto {
  @IsString()
  @IsNotEmpty()
  fromUserId: string;

  @IsString()
  @IsNotEmpty()
  toUserId: string;

  @IsString()
  @IsNotEmpty()
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
