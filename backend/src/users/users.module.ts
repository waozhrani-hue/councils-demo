import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [WorkflowModule],
  controllers: [UsersController, TeamController],
  providers: [UsersService, TeamService],
  exports: [UsersService, TeamService],
})
export class UsersModule {}
