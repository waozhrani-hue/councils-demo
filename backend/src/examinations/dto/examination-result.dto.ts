import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class ExaminationResultDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['COMPLETE', 'INCOMPLETE'])
  result: string;

  @IsString()
  @IsOptional()
  reasons?: string;
}
