import { IsString, IsNotEmpty } from 'class-validator';

export class MeetingTransitionDto {
  @IsString()
  @IsNotEmpty()
  action: string;
}
