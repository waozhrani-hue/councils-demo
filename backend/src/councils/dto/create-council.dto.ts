import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCouncilDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
