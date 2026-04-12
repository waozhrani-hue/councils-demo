import { IsString, IsNotEmpty } from 'class-validator';

export class ManualResolveDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
