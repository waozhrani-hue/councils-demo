import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateTopicDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsNotEmpty()
  councilId: string;

  @IsString()
  @IsOptional()
  secrecyLevelId?: string;

  @IsBoolean()
  @IsOptional()
  submit?: boolean;
}
