import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowEngineService } from './workflow-engine.service';
import { HierarchicalApprovalService } from './hierarchical-approval.service';
import { WorkflowController } from './workflow.controller';
import { DynamicPermissionService } from '../auth/dynamic-permission.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowController],
  providers: [WorkflowEngineService, HierarchicalApprovalService, DynamicPermissionService],
  exports: [WorkflowEngineService, HierarchicalApprovalService, DynamicPermissionService],
})
export class WorkflowModule {}
