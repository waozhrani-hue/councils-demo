import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TransitionDto {
  @IsString()
  @IsNotEmpty()
  action: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  returnType?: string;
}
