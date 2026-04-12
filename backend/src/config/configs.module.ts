import { Module } from '@nestjs/common';
import { ConfigsService } from './configs.service';
import { ConfigsController } from './configs.controller';

@Module({
  controllers: [ConfigsController],
  providers: [ConfigsService],
  exports: [ConfigsService],
})
export class ConfigsModule {}
