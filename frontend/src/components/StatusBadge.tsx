import { Tag } from 'antd';

const statusColorMap: Record<string, string> = {
  // ── Topic statuses ──
  DRAFT: 'default',
  PENDING_DEPT_MGR: 'processing',
  APPROVED: 'success',
  SENT_TO_GS: 'processing',
  INBOX_GS: 'processing',
  GS_REVIEW: 'processing',
  SUSPENDED: 'warning',
  RETURNED_DEPT: 'error',
  CLOSED_BY_DEPT: 'default',
  WITH_COUNCIL: 'processing',
  EXAM_IN_PROGRESS: 'processing',
  EXAM_COMPLETE: 'success',
  EXAM_INCOMPLETE: 'warning',
  PRESIDENT_REVIEW: 'processing',
  RETURNED_COUNCIL: 'error',
  IN_AGENDA_BOX: 'cyan',
  LINKED_TO_MEETING: 'blue',
  DEFERRED_IN_SESSION: 'warning',
  DISCUSSED: 'success',

  // ── Meeting statuses ──
  MEETING_DRAFT_SEC: 'default',
  MEETING_GS_APPROVAL: 'processing',
  MEETING_PRES_APPROVAL: 'processing',
  MEETING_SCHEDULED: 'cyan',
  MEETING_IN_SESSION: 'blue',
  MEETING_HELD: 'success',
  MEETING_CANCELLED: 'error',

  // ── Minutes statuses ──
  MIN_DRAFT: 'default',
  MIN_GS_REVIEW: 'processing',
  MIN_GS_RETURNED: 'error',
  MIN_MEMBERS_CONSULT: 'processing',
  MIN_TO_PRESIDENT: 'processing',
  MIN_SIGNED: 'success',
  MIN_PRES_REJECT: 'error',

  // ── Decision statuses ──
  DEC_DRAFT: 'default',
  DEC_ISSUED: 'success',

  // ── Delegation statuses ──
  DELEGATION_DRAFT: 'default',
  DELEGATION_ACTIVE: 'success',
  DELEGATION_SUSPENDED: 'warning',
  DELEGATION_REVOKED: 'error',
  DELEGATION_EXPIRED: 'default',

  // ── Notification statuses ──
  NOTIF_PENDING: 'processing',
  NOTIF_SENT: 'success',
  NOTIF_FAILED: 'error',
  NOTIF_RESOLVED: 'default',
};

const statusLabelMap: Record<string, string> = {
  // ── Topic statuses ──
  DRAFT: 'مسودة',
  PENDING_DEPT_MGR: 'بانتظار مدير الإدارة',
  APPROVED: 'معتمد من المدير',
  SENT_TO_GS: 'أُرسل للأمين العام',
  INBOX_GS: 'وارد الأمانة',
  GS_REVIEW: 'قيد مراجعة الأمين',
  SUSPENDED: 'معلّق',
  RETURNED_DEPT: 'مُعاد للإدارة',
  CLOSED_BY_DEPT: 'مُغلق من الإدارة',
  WITH_COUNCIL: 'لدى المجلس',
  EXAM_IN_PROGRESS: 'قيد الفحص',
  EXAM_COMPLETE: 'فحص مكتمل',
  EXAM_INCOMPLETE: 'فحص غير مكتمل',
  PRESIDENT_REVIEW: 'مراجعة الرئيس',
  RETURNED_COUNCIL: 'مُعاد من الرئيس',
  IN_AGENDA_BOX: 'في صندوق الأجندة',
  LINKED_TO_MEETING: 'مرتبط باجتماع',
  DEFERRED_IN_SESSION: 'مُؤجل في الجلسة',
  DISCUSSED: 'تمت المناقشة',

  // ── Meeting statuses ──
  MEETING_DRAFT_SEC: 'مسودة (أمين المجلس)',
  MEETING_GS_APPROVAL: 'بانتظار الأمين العام',
  MEETING_PRES_APPROVAL: 'بانتظار رئيس المجلس',
  MEETING_SCHEDULED: 'مجدول',
  MEETING_IN_SESSION: 'جلسة منعقدة',
  MEETING_HELD: 'انعقد',
  MEETING_CANCELLED: 'ملغي',

  // ── Minutes statuses ──
  MIN_DRAFT: 'مسودة محضر',
  MIN_GS_REVIEW: 'مراجعة الأمين العام',
  MIN_GS_RETURNED: 'مُعاد من الأمين العام',
  MIN_MEMBERS_CONSULT: 'بانتظار مرئيات الأعضاء',
  MIN_TO_PRESIDENT: 'بانتظار توقيع الرئيس',
  MIN_SIGNED: 'موقّع',
  MIN_PRES_REJECT: 'مرفوض من الرئيس',

  // ── Decision statuses ──
  DEC_DRAFT: 'مسودة قرار',
  DEC_ISSUED: 'صادر',

  // ── Delegation statuses ──
  DELEGATION_DRAFT: 'مسودة تفويض',
  DELEGATION_ACTIVE: 'تفويض نشط',
  DELEGATION_SUSPENDED: 'تفويض مُعلّق',
  DELEGATION_REVOKED: 'تفويض ملغي',
  DELEGATION_EXPIRED: 'تفويض منتهي',

  // ── Notification statuses ──
  NOTIF_PENDING: 'بانتظار الإرسال',
  NOTIF_SENT: 'مُرسل',
  NOTIF_FAILED: 'فشل الإرسال',
  NOTIF_RESOLVED: 'تم الحل',
};

// Export for reuse in dropdowns
export { statusLabelMap };

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const color = statusColorMap[status] || 'default';
  const label = statusLabelMap[status] || status;

  return <Tag color={color}>{label}</Tag>;
}
