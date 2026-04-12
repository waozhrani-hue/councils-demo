import { IsString, IsOptional } from 'class-validator';

export class UpdateTopicDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  councilId?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  secrecyLevelId?: string;
}
