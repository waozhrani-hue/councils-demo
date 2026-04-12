import { Module } from '@nestjs/common';
import { CouncilsService } from './councils.service';
import { CouncilsController } from './councils.controller';

@Module({
  controllers: [CouncilsController],
  providers: [CouncilsService],
  exports: [CouncilsService],
})
export class CouncilsModule {}
