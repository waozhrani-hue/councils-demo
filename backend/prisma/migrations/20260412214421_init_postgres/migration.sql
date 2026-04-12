-- CreateTable
CREATE TABLE "OrganizationUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT,
    "maxClearanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "councilId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DELEGATION_DRAFT',
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeJson" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Council" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Council_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "refNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "secrecyLevelId" TEXT,
    "councilId" TEXT NOT NULL,
    "requestingOrgId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "returnType" TEXT,
    "agendaOrder" INTEGER,
    "agendaEnteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicAttachment" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicStatusLog" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "delegationId" TEXT,
    "reason" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GSReview" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "delegationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GSReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Examination" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "examinerId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reasons" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Examination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "refNumber" TEXT NOT NULL,
    "councilId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MEETING_DRAFT_SEC',
    "title" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "heldAt" TIMESTAMP(3),
    "location" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingTopicLink" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "slotStatus" TEXT NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "MeetingTopicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Minutes" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MIN_DRAFT',
    "body" TEXT,
    "feedbackDeadline" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinuteMemberFeedback" (
    "id" TEXT NOT NULL,
    "minutesId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinuteMemberFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "refNumber" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "minutesId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DEC_DRAFT',
    "summary" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOTIF_PENDING',
    "decisionId" TEXT,
    "recipientId" TEXT NOT NULL,
    "recipientOrgId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "readAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "errorDetail" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorActualId" TEXT NOT NULL,
    "actorDisplayId" TEXT NOT NULL,
    "visibilityProfile" TEXT NOT NULL DEFAULT 'FULL_AUDIT',
    "delegationId" TEXT,
    "reason" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'STRING',
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUnit_code_key" ON "OrganizationUnit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SecretLevel_sortOrder_key" ON "SecretLevel"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_councilId_idx" ON "UserRole"("councilId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_councilId_key" ON "UserRole"("userId", "roleId", "councilId");

-- CreateIndex
CREATE INDEX "Delegation_fromUserId_state_idx" ON "Delegation"("fromUserId", "state");

-- CreateIndex
CREATE INDEX "Delegation_toUserId_state_idx" ON "Delegation"("toUserId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Council_code_key" ON "Council"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_refNumber_key" ON "Topic"("refNumber");

-- CreateIndex
CREATE INDEX "Topic_councilId_status_idx" ON "Topic"("councilId", "status");

-- CreateIndex
CREATE INDEX "Topic_requestingOrgId_idx" ON "Topic"("requestingOrgId");

-- CreateIndex
CREATE INDEX "Topic_status_agendaEnteredAt_idx" ON "Topic"("status", "agendaEnteredAt");

-- CreateIndex
CREATE INDEX "TopicAttachment_topicId_idx" ON "TopicAttachment"("topicId");

-- CreateIndex
CREATE INDEX "TopicStatusLog_topicId_createdAt_idx" ON "TopicStatusLog"("topicId", "createdAt");

-- CreateIndex
CREATE INDEX "GSReview_topicId_idx" ON "GSReview"("topicId");

-- CreateIndex
CREATE INDEX "Examination_topicId_idx" ON "Examination"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_refNumber_key" ON "Meeting"("refNumber");

-- CreateIndex
CREATE INDEX "Meeting_councilId_status_idx" ON "Meeting"("councilId", "status");

-- CreateIndex
CREATE INDEX "MeetingTopicLink_meetingId_idx" ON "MeetingTopicLink"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingTopicLink_meetingId_topicId_key" ON "MeetingTopicLink"("meetingId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "Minutes_meetingId_key" ON "Minutes"("meetingId");

-- CreateIndex
CREATE INDEX "Minutes_meetingId_idx" ON "Minutes"("meetingId");

-- CreateIndex
CREATE INDEX "MinuteMemberFeedback_minutesId_idx" ON "MinuteMemberFeedback"("minutesId");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_refNumber_key" ON "Decision"("refNumber");

-- CreateIndex
CREATE INDEX "Decision_topicId_status_idx" ON "Decision"("topicId", "status");

-- CreateIndex
CREATE INDEX "Notification_recipientId_status_idx" ON "Notification"("recipientId", "status");

-- CreateIndex
CREATE INDEX "NotificationDeliveryAttempt_notificationId_idx" ON "NotificationDeliveryAttempt"("notificationId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorActualId_createdAt_idx" ON "AuditLog"("actorActualId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- AddForeignKey
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_maxClearanceId_fkey" FOREIGN KEY ("maxClearanceId") REFERENCES "SecretLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_councilId_fkey" FOREIGN KEY ("councilId") REFERENCES "Council"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_secrecyLevelId_fkey" FOREIGN KEY ("secrecyLevelId") REFERENCES "SecretLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_councilId_fkey" FOREIGN KEY ("councilId") REFERENCES "Council"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_requestingOrgId_fkey" FOREIGN KEY ("requestingOrgId") REFERENCES "OrganizationUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicAttachment" ADD CONSTRAINT "TopicAttachment_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicStatusLog" ADD CONSTRAINT "TopicStatusLog_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicStatusLog" ADD CONSTRAINT "TopicStatusLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GSReview" ADD CONSTRAINT "GSReview_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GSReview" ADD CONSTRAINT "GSReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examination" ADD CONSTRAINT "Examination_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examination" ADD CONSTRAINT "Examination_examinerId_fkey" FOREIGN KEY ("examinerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examination" ADD CONSTRAINT "Examination_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_councilId_fkey" FOREIGN KEY ("councilId") REFERENCES "Council"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTopicLink" ADD CONSTRAINT "MeetingTopicLink_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTopicLink" ADD CONSTRAINT "MeetingTopicLink_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinuteMemberFeedback" ADD CONSTRAINT "MinuteMemberFeedback_minutesId_fkey" FOREIGN KEY ("minutesId") REFERENCES "Minutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinuteMemberFeedback" ADD CONSTRAINT "MinuteMemberFeedback_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_minutesId_fkey" FOREIGN KEY ("minutesId") REFERENCES "Minutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorActualId_fkey" FOREIGN KEY ("actorActualId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorDisplayId_fkey" FOREIGN KEY ("actorDisplayId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
