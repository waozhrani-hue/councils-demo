import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsString()
  @IsOptional()
  recipientOrgId?: string;

  @IsString()
  @IsOptional()
  decisionId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  body?: string;
}
