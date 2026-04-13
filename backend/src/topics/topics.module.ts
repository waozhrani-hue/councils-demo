import { Module } from '@nestjs/common';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';
import { TopicsWorkflowService } from './topics-workflow.service';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [WorkflowModule],
  controllers: [TopicsController],
  providers: [TopicsService, TopicsWorkflowService],
  exports: [TopicsService, TopicsWorkflowService],
})
export class TopicsModule {}
