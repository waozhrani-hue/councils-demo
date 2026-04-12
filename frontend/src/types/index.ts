export interface User {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  organizationId?: string;
  roles: UserRoleBrief[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserRoleBrief {
  code: RoleName;
  councilId: string | null;
}

export type RoleName =
  | 'SYSTEM_ADMIN'
  | 'DEPT_STAFF'
  | 'DEPT_MANAGER'
  | 'GENERAL_SECRETARY'
  | 'GS_OFFICE_STAFF'
  | 'EXAM_OFFICER'
  | 'COUNCIL_SECRETARY'
  | 'COUNCIL_PRESIDENT'
  | 'COUNCIL_MEMBER'
  | 'COUNCIL_STAFF';

export interface Role {
  id: string;
  name: RoleName;
  description?: string;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  councilId?: string;
  orgUnitId?: string;
  role: Role;
  council?: Council;
  orgUnit?: OrganizationUnit;
}

export interface Council {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationUnit {
  id: string;
  name: string;
  parentId?: string;
  parent?: OrganizationUnit;
  children?: OrganizationUnit[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SecretLevel {
  id: string;
  name: string;
  level: number;
}

export type TopicStatus =
  | 'DRAFT'
  | 'PENDING_DEPT_MGR'
  | 'APPROVED'
  | 'SENT_TO_GS'
  | 'INBOX_GS'
  | 'GS_REVIEW'
  | 'SUSPENDED'
  | 'RETURNED_DEPT'
  | 'CLOSED_BY_DEPT'
  | 'WITH_COUNCIL'
  | 'EXAM_IN_PROGRESS'
  | 'EXAM_COMPLETE'
  | 'EXAM_INCOMPLETE'
  | 'PRESIDENT_REVIEW'
  | 'RETURNED_COUNCIL'
  | 'IN_AGENDA_BOX'
  | 'LINKED_TO_MEETING'
  | 'DEFERRED_IN_SESSION'
  | 'DISCUSSED';

export interface Topic {
  id: string;
  referenceNumber: string;
  title: string;
  body?: string;
  status: TopicStatus;
  councilId: string;
  council?: Council;
  orgUnitId?: string;
  orgUnit?: OrganizationUnit;
  secrecyLevelId?: string;
  secrecyLevel?: SecretLevel;
  createdById: string;
  createdBy?: User;
  createdAt: string;
  updatedAt: string;
  attachments?: TopicAttachment[];
  statusLogs?: TopicStatusLog[];
}

export interface TopicAttachment {
  id: string;
  topicId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploadedBy?: User;
  createdAt: string;
}

export interface TopicStatusLog {
  id: string;
  topicId: string;
  fromStatus?: TopicStatus;
  toStatus: TopicStatus;
  changedById: string;
  changedBy?: User;
  reason?: string;
  createdAt: string;
}

export type MeetingStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'IN_SESSION'
  | 'ADJOURNED'
  | 'ENDED'
  | 'CANCELLED';

export interface Meeting {
  id: string;
  title: string;
  councilId: string;
  council?: Council;
  meetingNumber?: string;
  scheduledDate: string;
  location?: string;
  status: MeetingStatus;
  createdById: string;
  createdBy?: User;
  createdAt: string;
  updatedAt: string;
  topicLinks?: MeetingTopicLink[];
  minutes?: Minutes;
}

export interface MeetingTopicLink {
  id: string;
  meetingId: string;
  topicId: string;
  topic?: Topic;
  order: number;
}

export type MinutesStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'REVIEWED'
  | 'APPROVED'
  | 'REJECTED';

export interface Minutes {
  id: string;
  meetingId: string;
  meeting?: Meeting;
  body: string;
  status: MinutesStatus;
  createdById: string;
  createdBy?: User;
  createdAt: string;
  updatedAt: string;
  feedbacks?: MinuteMemberFeedback[];
}

export interface MinuteMemberFeedback {
  id: string;
  minutesId: string;
  userId: string;
  user?: User;
  approved: boolean;
  comment?: string;
  createdAt: string;
}

export type DecisionStatus = 'ACTIVE' | 'SUPERSEDED' | 'REVOKED';

export interface Decision {
  id: string;
  decisionNumber: string;
  topicId: string;
  topic?: Topic;
  meetingId: string;
  meeting?: Meeting;
  councilId: string;
  council?: Council;
  body: string;
  status: DecisionStatus;
  decidedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export type DelegationStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface Delegation {
  id: string;
  fromUserId: string;
  fromUser?: User;
  toUserId: string;
  toUser?: User;
  councilId?: string;
  council?: Council;
  startDate: string;
  endDate: string;
  status: DelegationStatus;
  reason?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  user?: User;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
