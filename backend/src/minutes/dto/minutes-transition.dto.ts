import { IsString, IsNotEmpty } from 'class-validator';

export class MinutesTransitionDto {
  @IsString()
  @IsNotEmpty()
  action: string;
}
