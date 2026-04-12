import { IsString, IsNotEmpty } from 'class-validator';

export class CreateExaminationDto {
  @IsString()
  @IsNotEmpty()
  topicId: string;

  @IsString()
  @IsNotEmpty()
  examinerId: string;
}
