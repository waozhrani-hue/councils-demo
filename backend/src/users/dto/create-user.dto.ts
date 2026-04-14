import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  maxClearanceId?: string;

  @IsOptional()
  isActive?: boolean;
}
