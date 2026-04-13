import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CouncilsModule } from './councils/councils.module';
import { OrgUnitsModule } from './org-units/org-units.module';
import { TopicsModule } from './topics/topics.module';
import { ExaminationsModule } from './examinations/examinations.module';
import { MeetingsModule } from './meetings/meetings.module';
import { MinutesModule } from './minutes/minutes.module';
import { DecisionsModule } from './decisions/decisions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DelegationsModule } from './delegations/delegations.module';
import { AuditModule } from './audit/audit.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ConfigsModule } from './config/configs.module';
import { WorkflowModule } from './workflow/workflow.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CouncilsModule,
    OrgUnitsModule,
    TopicsModule,
    ExaminationsModule,
    MeetingsModule,
    MinutesModule,
    DecisionsModule,
    NotificationsModule,
    DelegationsModule,
    AuditModule,
    DashboardModule,
    ConfigsModule,
    WorkflowModule,
  ],
})
export class AppModule {}
