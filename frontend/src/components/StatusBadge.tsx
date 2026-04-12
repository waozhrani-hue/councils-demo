import { Tag } from 'antd';
import type { TopicStatus, MeetingStatus, MinutesStatus, DecisionStatus, DelegationStatus } from '@/types';

type AnyStatus = TopicStatus | MeetingStatus | MinutesStatus | DecisionStatus | DelegationStatus | string;

const statusColorMap: Record<string, string> = {
  DRAFT: 'default',
  PENDING_DEPT_MANAGER: 'processing',
  RETURNED_TO_STAFF: 'error',
  APPROVED_BY_MANAGER: 'success',
  REJECTED_BY_MANAGER: 'error',
  INBOX_GS: 'processing',
  GS_REVIEW: 'processing',
  SUSPENDED: 'warning',
  RETURNED_BY_GS: 'error',
  REJECTED_BY_GS: 'error',
  FORWARDED_TO_EXAM: 'processing',
  EXAM_IN_PROGRESS: 'processing',
  EXAM_COMPLETE: 'success',
  EXAM_INCOMPLETE: 'warning',
  IN_AGENDA_BOX: 'processing',
  SCHEDULED: 'processing',
  IN_SESSION: 'processing',
  DECIDED: 'success',
  ARCHIVED: 'default',
  ADJOURNED: 'warning',
  ENDED: 'default',
  CANCELLED: 'error',
  PENDING_REVIEW: 'processing',
  REVIEWED: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  ACTIVE: 'success',
  SUPERSEDED: 'warning',
  REVOKED: 'error',
  EXPIRED: 'default',
};

const statusLabelMap: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING_DEPT_MANAGER: 'بانتظار مدير الإدارة',
  RETURNED_TO_STAFF: 'معاد للموظف',
  APPROVED_BY_MANAGER: 'معتمد من المدير',
  REJECTED_BY_MANAGER: 'مرفوض من المدير',
  INBOX_GS: 'وارد الأمانة',
  GS_REVIEW: 'قيد المراجعة',
  SUSPENDED: 'معلق',
  RETURNED_BY_GS: 'معاد من الأمانة',
  REJECTED_BY_GS: 'مرفوض من الأمانة',
  FORWARDED_TO_EXAM: 'محال للفحص',
  EXAM_IN_PROGRESS: 'قيد الفحص',
  EXAM_COMPLETE: 'فحص مكتمل',
  EXAM_INCOMPLETE: 'فحص غير مكتمل',
  IN_AGENDA_BOX: 'في صندوق الأجندة',
  SCHEDULED: 'مجدول',
  IN_SESSION: 'في الجلسة',
  DECIDED: 'تم البت',
  ARCHIVED: 'مؤرشف',
  ADJOURNED: 'مؤجل',
  ENDED: 'منتهي',
  CANCELLED: 'ملغي',
  PENDING_REVIEW: 'بانتظار المراجعة',
  REVIEWED: 'تمت المراجعة',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  ACTIVE: 'نشط',
  SUPERSEDED: 'مستبدل',
  REVOKED: 'ملغي',
  EXPIRED: 'منتهي الصلاحية',
};

interface StatusBadgeProps {
  status: AnyStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const color = statusColorMap[status] || 'default';
  const label = statusLabelMap[status] || status;

  return <Tag color={color}>{label}</Tag>;
}
