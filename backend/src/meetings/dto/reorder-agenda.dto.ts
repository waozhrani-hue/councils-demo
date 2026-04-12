import { IsArray, IsString } from 'class-validator';

export class ReorderAgendaDto {
  @IsArray()
  @IsString({ each: true })
  orderedTopicIds: string[];
}
