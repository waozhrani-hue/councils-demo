import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔄 بدء توليد بيانات الاختبار الديناميكية...\n');

  // ─── تنظيف ───
  console.log('🗑️  تنظيف...');
  const tableNames = [
    'TopicApprovalStep', 'AuditLog', 'NotificationDeliveryAttempt', 'Notification',
    'Decision', 'MinuteMemberFeedback', 'Minutes', 'MeetingTopicLink', 'Meeting',
    'Examination', 'GSReview', 'TopicStatusLog', 'TopicAttachment', 'Topic',
    'Delegation', 'SystemConfig', 'UserRole', 'RolePermission', 'Permission',
    'WorkflowTransition', 'WorkflowState', 'WorkflowDefinition',
    'Role', 'User', 'Council', 'OrganizationUnit', 'SecretLevel',
  ];
  for (const t of tableNames) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" CASCADE`);
  }
  console.log('✅ تم التنظيف');

  const hash = await bcrypt.hash('Admin@123', 10);

  // ═══════════════════════════════════════════════
  // 1. مستويات السرية
  // ═══════════════════════════════════════════════
  console.log('📊 مستويات السرية...');
  const sl = {
    public: await prisma.secretLevel.create({ data: { name: 'عام', sortOrder: 1 } }),
    internal: await prisma.secretLevel.create({ data: { name: 'داخلي', sortOrder: 2 } }),
    confidential: await prisma.secretLevel.create({ data: { name: 'سري', sortOrder: 3 } }),
    topSecret: await prisma.secretLevel.create({ data: { name: 'سري للغاية', sortOrder: 4 } }),
  };

  // ═══════════════════════════════════════════════
  // 2. الصلاحيات الديناميكية
  // ═══════════════════════════════════════════════
  console.log('🔐 الصلاحيات...');
  const permDefs = [
    // TOPIC
    { code: 'CREATE_TOPIC', nameAr: 'إنشاء موضوع', module: 'TOPIC' },
    { code: 'VIEW_TOPICS', nameAr: 'عرض المواضيع', module: 'TOPIC' },
    { code: 'VIEW_ALL_TOPICS', nameAr: 'عرض جميع المواضيع', module: 'TOPIC' },
    { code: 'EDIT_OWN_TOPIC', nameAr: 'تعديل موضوعي', module: 'TOPIC' },
    { code: 'SUBMIT_TOPIC', nameAr: 'إرسال موضوع', module: 'TOPIC' },
    { code: 'APPROVE_TOPIC', nameAr: 'اعتماد موضوع (هرمي)', module: 'TOPIC' },
    { code: 'REJECT_TOPIC', nameAr: 'رفض موضوع', module: 'TOPIC' },
    { code: 'RETURN_TOPIC', nameAr: 'إعادة موضوع', module: 'TOPIC' },
    { code: 'SEND_TO_GS', nameAr: 'إرسال للأمانة', module: 'TOPIC' },
    { code: 'ACCEPT_GS', nameAr: 'قبول الأمين العام', module: 'TOPIC' },
    { code: 'REJECT_GS', nameAr: 'رفض الأمين العام', module: 'TOPIC' },
    { code: 'RETURN_GS', nameAr: 'إعادة الأمين العام', module: 'TOPIC' },
    { code: 'RESUBMIT_TOPIC', nameAr: 'إعادة إرسال موضوع', module: 'TOPIC' },
    { code: 'CLOSE_TOPIC', nameAr: 'إغلاق موضوع', module: 'TOPIC' },
    // EXAMINATION
    { code: 'ASSIGN_EXAM', nameAr: 'إحالة للفحص', module: 'EXAMINATION' },
    { code: 'PERFORM_EXAM', nameAr: 'تنفيذ الفحص', module: 'EXAMINATION' },
    { code: 'SUBMIT_TO_PRESIDENT', nameAr: 'رفع لرئيس المجلس', module: 'EXAMINATION' },
    // COUNCIL
    { code: 'REVIEW_AS_PRESIDENT', nameAr: 'مراجعة كرئيس مجلس', module: 'COUNCIL' },
    { code: 'MANAGE_AGENDA', nameAr: 'إدارة صندوق الأجندة', module: 'COUNCIL' },
    { code: 'LINK_TO_MEETING', nameAr: 'ربط باجتماع', module: 'COUNCIL' },
    // MEETING
    { code: 'CREATE_MEETING', nameAr: 'إنشاء اجتماع', module: 'MEETING' },
    { code: 'VIEW_MEETINGS', nameAr: 'عرض الاجتماعات', module: 'MEETING' },
    { code: 'APPROVE_MEETING_GS', nameAr: 'اعتماد اجتماع (أمين عام)', module: 'MEETING' },
    { code: 'APPROVE_MEETING_PRES', nameAr: 'اعتماد اجتماع (رئيس)', module: 'MEETING' },
    { code: 'HOLD_MEETING', nameAr: 'عقد اجتماع', module: 'MEETING' },
    { code: 'CANCEL_MEETING', nameAr: 'إلغاء اجتماع', module: 'MEETING' },
    // MINUTES
    { code: 'CREATE_MINUTES', nameAr: 'إنشاء محضر', module: 'MINUTES' },
    { code: 'VIEW_MINUTES', nameAr: 'عرض المحاضر', module: 'MINUTES' },
    { code: 'REVIEW_MINUTES_GS', nameAr: 'مراجعة محضر (أمين عام)', module: 'MINUTES' },
    { code: 'SIGN_MINUTES', nameAr: 'توقيع محضر', module: 'MINUTES' },
    { code: 'PROVIDE_FEEDBACK', nameAr: 'تقديم ملاحظات على المحضر', module: 'MINUTES' },
    // DECISION
    { code: 'VIEW_DECISIONS', nameAr: 'عرض القرارات', module: 'DECISION' },
    { code: 'ISSUE_DECISION', nameAr: 'إصدار قرار', module: 'DECISION' },
    // ADMIN
    { code: 'MANAGE_USERS', nameAr: 'إدارة المستخدمين', module: 'ADMIN' },
    { code: 'MANAGE_ROLES', nameAr: 'إدارة الأدوار', module: 'ADMIN' },
    { code: 'MANAGE_ORG_STRUCTURE', nameAr: 'إدارة الهيكل التنظيمي', module: 'ADMIN' },
    { code: 'MANAGE_WORKFLOWS', nameAr: 'إدارة مسارات العمل', module: 'ADMIN' },
    { code: 'MANAGE_COUNCILS', nameAr: 'إدارة المجالس', module: 'ADMIN' },
    { code: 'MANAGE_CONFIG', nameAr: 'إدارة التهيئة', module: 'ADMIN' },
    { code: 'VIEW_AUDIT', nameAr: 'عرض التدقيق', module: 'ADMIN' },
    // DELEGATION & TEAM
    { code: 'CREATE_DELEGATION', nameAr: 'إنشاء تفويض', module: 'DELEGATION' },
    { code: 'MANAGE_TEAM', nameAr: 'إدارة الفريق', module: 'DELEGATION' },
    // NOTIFICATION
    { code: 'VIEW_NOTIFICATIONS', nameAr: 'عرض الإشعارات', module: 'NOTIFICATION' },
  ];

  const perms: Record<string, string> = {};
  for (const p of permDefs) {
    const created = await prisma.permission.create({ data: p });
    perms[p.code] = created.id;
  }

  // ═══════════════════════════════════════════════
  // 3. الأدوار الديناميكية + ربط الصلاحيات
  // ═══════════════════════════════════════════════
  console.log('👥 الأدوار...');

  const roleDefs: { code: string; nameAr: string; scope: string; isSystem: boolean; permissions: string[] }[] = [
    {
      code: 'SYSTEM_ADMIN', nameAr: 'مدير النظام', scope: 'GLOBAL', isSystem: true,
      permissions: [
        'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_ORG_STRUCTURE', 'MANAGE_WORKFLOWS',
        'MANAGE_COUNCILS', 'MANAGE_CONFIG', 'VIEW_AUDIT', 'VIEW_ALL_TOPICS',
        'VIEW_MEETINGS', 'VIEW_MINUTES', 'VIEW_DECISIONS', 'VIEW_NOTIFICATIONS',
      ],
    },
    {
      code: 'EMPLOYEE', nameAr: 'موظف', scope: 'ORG_UNIT', isSystem: true,
      permissions: [
        'CREATE_TOPIC', 'VIEW_TOPICS', 'EDIT_OWN_TOPIC', 'SUBMIT_TOPIC',
        'VIEW_DECISIONS', 'VIEW_NOTIFICATIONS',
      ],
    },
    {
      code: 'ORG_MANAGER', nameAr: 'مسؤول وحدة تنظيمية', scope: 'ORG_UNIT', isSystem: true,
      permissions: [
        'CREATE_TOPIC', 'VIEW_TOPICS', 'EDIT_OWN_TOPIC', 'SUBMIT_TOPIC',
        'APPROVE_TOPIC', 'REJECT_TOPIC', 'RETURN_TOPIC', 'SEND_TO_GS',
        'RESUBMIT_TOPIC', 'CLOSE_TOPIC',
        'MANAGE_TEAM', 'CREATE_DELEGATION',
        'VIEW_DECISIONS', 'VIEW_NOTIFICATIONS',
      ],
    },
    {
      code: 'GENERAL_SECRETARY', nameAr: 'الأمين العام', scope: 'GLOBAL', isSystem: true,
      permissions: [
        'VIEW_ALL_TOPICS', 'ACCEPT_GS', 'REJECT_GS', 'RETURN_GS',
        'APPROVE_MEETING_GS', 'REVIEW_MINUTES_GS',
        'VIEW_MEETINGS', 'VIEW_MINUTES', 'VIEW_DECISIONS',
        'CREATE_DELEGATION', 'MANAGE_TEAM', 'VIEW_NOTIFICATIONS',
      ],
    },
    {
      code: 'GS_OFFICE_STAFF', nameAr: 'موظف مكتب الأمين العام', scope: 'GLOBAL', isSystem: true,
      permissions: [
        'VIEW_ALL_TOPICS', 'VIEW_MEETINGS', 'VIEW_MINUTES', 'VIEW_DECISIONS', 'VIEW_NOTIFICATIONS',
      ],
    },
    {
      code: 'COUNCIL_SECRETARY', nameAr: 'أمين المجلس', scope: 'COUNCIL', isSystem: true,
      permissions: [
        'VIEW_TOPICS', 'ASSIGN_EXAM', 'SUBMIT_TO_PRESIDENT', 'MANAGE_AGENDA', 'LINK_TO_MEETING',
        'CREATE_MEETING', 'VIEW_MEETINGS', 'HOLD_MEETING', 'CANCEL_MEETING',
        'CREATE_MINUTES', 'VIEW_MINUTES',
        'MANAGE_TEAM', 'CREATE_DELEGATION', 'VIEW_DECISIONS', 'VIEW_NOTIFICATIONS',
      ],
    },
    {
      code: 'COUNCIL_PRESIDENT', nameAr: 'رئيس المجلس', scope: 'COUNCIL', isSystem: true,
      permissions: [
        'VIEW_TOPICS', 'REVIEW_AS_PRESIDENT',
        'VIEW_MEETINGS', 'APPROVE_MEETING_PRES',
        'VIEW_MINUTES', 'SIGN_MINUTES',
        'ISSUE_DECISION', 'VIEW_DECISIONS', 'VIEW_NOTIFICATIONS',
      ],
    },
    {
      code: 'COUNCIL_MEMBER', nameAr: 'عضو مجلس', scope: 'COUNCIL', isSystem: true,
      permissions: [
        'VIEW_MEETINGS', 'VIEW_MINUTES', 'PROVIDE_FEEDBACK', 'VIEW_DECISIONS', 'VIEW_NOTIFICATIONS',
      ],
    },
    {
      code: 'EXAM_OFFICER', nameAr: 'مسؤول فحص', scope: 'COUNCIL', isSystem: true,
      permissions: ['PERFORM_EXAM', 'VIEW_TOPICS', 'VIEW_NOTIFICATIONS'],
    },
    {
      code: 'COUNCIL_STAFF', nameAr: 'موظف مجلس', scope: 'COUNCIL', isSystem: true,
      permissions: ['VIEW_MEETINGS', 'VIEW_DECISIONS', 'VIEW_NOTIFICATIONS'],
    },
  ];

  const roles: Record<string, string> = {};
  for (const r of roleDefs) {
    const role = await prisma.role.create({
      data: { code: r.code, nameAr: r.nameAr, scope: r.scope, isSystem: r.isSystem },
    });
    roles[r.code] = role.id;
    // ربط الصلاحيات
    for (const pCode of r.permissions) {
      if (perms[pCode]) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: perms[pCode] },
        });
      }
    }
  }

  // ═══════════════════════════════════════════════
  // 4. مسارات العمل (Workflow Definitions)
  // ═══════════════════════════════════════════════
  console.log('⚙️  مسارات العمل...');

  // ── 4.1 مسار المواضيع ──
  const topicWf = await prisma.workflowDefinition.create({
    data: { code: 'TOPIC_WORKFLOW', nameAr: 'مسار المواضيع', entityType: 'Topic' },
  });

  const topicStates = [
    { code: 'DRAFT', nameAr: 'مسودة', stateType: 'INITIAL', color: 'default', sortOrder: 1 },
    { code: 'PENDING_APPROVAL', nameAr: 'قيد الاعتماد الهرمي', stateType: 'APPROVAL', color: 'processing', sortOrder: 2 },
    { code: 'HIERARCHY_APPROVED', nameAr: 'معتمد من الإدارة', stateType: 'NORMAL', color: 'success', sortOrder: 3 },
    { code: 'SENT_TO_GS', nameAr: 'مُرسل للأمانة', stateType: 'NORMAL', color: 'processing', sortOrder: 4 },
    { code: 'INBOX_GS', nameAr: 'وارد الأمانة', stateType: 'NORMAL', color: 'warning', sortOrder: 5 },
    { code: 'GS_REVIEW', nameAr: 'قيد مراجعة الأمين', stateType: 'NORMAL', color: 'warning', sortOrder: 6 },
    { code: 'RETURNED_DEPT', nameAr: 'مُعاد للإدارة', stateType: 'NORMAL', color: 'error', sortOrder: 7 },
    { code: 'CLOSED_BY_DEPT', nameAr: 'مغلق من الإدارة', stateType: 'FINAL', color: 'default', sortOrder: 8 },
    { code: 'WITH_COUNCIL', nameAr: 'لدى المجلس', stateType: 'NORMAL', color: 'purple', sortOrder: 9 },
    { code: 'EXAM_IN_PROGRESS', nameAr: 'قيد الفحص', stateType: 'NORMAL', color: 'processing', sortOrder: 10 },
    { code: 'EXAM_COMPLETE', nameAr: 'فحص مكتمل', stateType: 'NORMAL', color: 'success', sortOrder: 11 },
    { code: 'EXAM_INCOMPLETE', nameAr: 'فحص غير مكتمل', stateType: 'NORMAL', color: 'error', sortOrder: 12 },
    { code: 'PRESIDENT_REVIEW', nameAr: 'مراجعة الرئيس', stateType: 'NORMAL', color: 'warning', sortOrder: 13 },
    { code: 'RETURNED_COUNCIL', nameAr: 'مُعاد من الرئيس', stateType: 'NORMAL', color: 'error', sortOrder: 14 },
    { code: 'IN_AGENDA_BOX', nameAr: 'في صندوق الأجندة', stateType: 'NORMAL', color: 'cyan', sortOrder: 15 },
    { code: 'LINKED_TO_MEETING', nameAr: 'مرتبط باجتماع', stateType: 'NORMAL', color: 'processing', sortOrder: 16 },
    { code: 'DEFERRED_IN_SESSION', nameAr: 'مؤجل في الجلسة', stateType: 'NORMAL', color: 'warning', sortOrder: 17 },
    { code: 'DISCUSSED', nameAr: 'نوقش', stateType: 'NORMAL', color: 'success', sortOrder: 18 },
    { code: 'DECISION_ISSUED', nameAr: 'صدر فيه قرار', stateType: 'FINAL', color: 'success', sortOrder: 19 },
  ];

  const ts: Record<string, string> = {};
  for (const s of topicStates) {
    const created = await prisma.workflowState.create({
      data: { workflowId: topicWf.id, ...s },
    });
    ts[s.code] = created.id;
  }

  // تحولات المواضيع
  const topicTransitions = [
    // DRAFT → إرسال للاعتماد الهرمي
    { from: 'DRAFT', to: 'PENDING_APPROVAL', actionCode: 'SUBMIT', actionNameAr: 'إرسال', permissionCode: 'SUBMIT_TOPIC', isHierarchical: true, buttonColor: 'primary', buttonIcon: 'SendOutlined', sortOrder: 1 },
    // الاعتماد الهرمي: اعتماد (ينتقل للمستوى التالي أو HIERARCHY_APPROVED)
    { from: 'PENDING_APPROVAL', to: 'PENDING_APPROVAL', actionCode: 'APPROVE_LEVEL', actionNameAr: 'اعتماد', permissionCode: 'APPROVE_TOPIC', isHierarchical: true, buttonColor: 'primary', buttonIcon: 'CheckOutlined', sortOrder: 1 },
    // رفض في أي مستوى
    { from: 'PENDING_APPROVAL', to: 'DRAFT', actionCode: 'REJECT_LEVEL', actionNameAr: 'رفض', permissionCode: 'REJECT_TOPIC', requiresReason: true, buttonColor: 'danger', buttonIcon: 'CloseOutlined', sortOrder: 3 },
    // إعادة للمستوى السابق
    { from: 'PENDING_APPROVAL', to: 'PENDING_APPROVAL', actionCode: 'RETURN_LEVEL', actionNameAr: 'إعادة للمستوى السابق', permissionCode: 'RETURN_TOPIC', requiresReason: true, isHierarchical: true, buttonColor: 'default', buttonIcon: 'RollbackOutlined', sortOrder: 2 },
    // معتمد → إرسال للأمانة (تلقائي)
    { from: 'HIERARCHY_APPROVED', to: 'SENT_TO_GS', actionCode: 'SEND_TO_GS', actionNameAr: 'إرسال للأمانة', permissionCode: 'SEND_TO_GS', autoTransition: true, sortOrder: 1 },
    // وارد الأمانة (تلقائي)
    { from: 'SENT_TO_GS', to: 'INBOX_GS', actionCode: 'AUTO_RECEIVE', actionNameAr: 'استلام تلقائي', permissionCode: 'ACCEPT_GS', autoTransition: true, sortOrder: 1 },
    { from: 'INBOX_GS', to: 'GS_REVIEW', actionCode: 'AUTO_REVIEW', actionNameAr: 'مراجعة تلقائية', permissionCode: 'ACCEPT_GS', autoTransition: true, sortOrder: 1 },
    // مراجعة الأمين العام
    { from: 'GS_REVIEW', to: 'WITH_COUNCIL', actionCode: 'ACCEPT', actionNameAr: 'قبول وتحويل للمجلس', permissionCode: 'ACCEPT_GS', buttonColor: 'primary', buttonIcon: 'CheckOutlined', sortOrder: 1 },
    { from: 'GS_REVIEW', to: 'RETURNED_DEPT', actionCode: 'RETURN_WRONG_COUNCIL', actionNameAr: 'إعادة (مجلس خاطئ)', permissionCode: 'RETURN_GS', requiresReason: true, buttonColor: 'default', buttonIcon: 'RollbackOutlined', sortOrder: 2 },
    { from: 'GS_REVIEW', to: 'RETURNED_DEPT', actionCode: 'REJECT', actionNameAr: 'رفض', permissionCode: 'REJECT_GS', requiresReason: true, buttonColor: 'danger', buttonIcon: 'CloseOutlined', sortOrder: 3 },
    // مُعاد للإدارة
    { from: 'RETURNED_DEPT', to: 'SENT_TO_GS', actionCode: 'RESUBMIT', actionNameAr: 'إعادة الإرسال', permissionCode: 'RESUBMIT_TOPIC', buttonColor: 'primary', buttonIcon: 'SendOutlined', sortOrder: 1 },
    { from: 'RETURNED_DEPT', to: 'CLOSED_BY_DEPT', actionCode: 'CLOSE_BY_DEPT', actionNameAr: 'إغلاق الموضوع', permissionCode: 'CLOSE_TOPIC', buttonColor: 'danger', buttonIcon: 'StopOutlined', sortOrder: 2 },
    // المجلس → فحص
    { from: 'WITH_COUNCIL', to: 'EXAM_IN_PROGRESS', actionCode: 'ASSIGN_EXAM', actionNameAr: 'إحالة للفحص', permissionCode: 'ASSIGN_EXAM', buttonColor: 'primary', buttonIcon: 'ExperimentOutlined', sortOrder: 1 },
    { from: 'EXAM_IN_PROGRESS', to: 'EXAM_COMPLETE', actionCode: 'EXAM_PASS', actionNameAr: 'فحص مكتمل', permissionCode: 'PERFORM_EXAM', buttonColor: 'primary', buttonIcon: 'CheckOutlined', sortOrder: 1 },
    { from: 'EXAM_IN_PROGRESS', to: 'EXAM_INCOMPLETE', actionCode: 'EXAM_FAIL', actionNameAr: 'فحص غير مكتمل', permissionCode: 'PERFORM_EXAM', requiresReason: true, buttonColor: 'danger', buttonIcon: 'CloseOutlined', sortOrder: 2 },
    { from: 'EXAM_INCOMPLETE', to: 'EXAM_IN_PROGRESS', actionCode: 'REEXAM', actionNameAr: 'إعادة الفحص', permissionCode: 'ASSIGN_EXAM', buttonColor: 'primary', buttonIcon: 'ExperimentOutlined', sortOrder: 1 },
    // فحص مكتمل → رئيس
    { from: 'EXAM_COMPLETE', to: 'PRESIDENT_REVIEW', actionCode: 'SUBMIT_TO_PRESIDENT', actionNameAr: 'رفع لرئيس المجلس', permissionCode: 'SUBMIT_TO_PRESIDENT', buttonColor: 'primary', buttonIcon: 'SendOutlined', sortOrder: 1 },
    // مراجعة الرئيس
    { from: 'PRESIDENT_REVIEW', to: 'IN_AGENDA_BOX', actionCode: 'MARK_SUITABLE', actionNameAr: 'مناسب للإدراج', permissionCode: 'REVIEW_AS_PRESIDENT', buttonColor: 'primary', buttonIcon: 'CheckOutlined', sortOrder: 1 },
    { from: 'PRESIDENT_REVIEW', to: 'RETURNED_COUNCIL', actionCode: 'RETURN_TO_COUNCIL', actionNameAr: 'إعادة للمجلس', permissionCode: 'REVIEW_AS_PRESIDENT', requiresReason: true, buttonColor: 'default', buttonIcon: 'RollbackOutlined', sortOrder: 2 },
    // مُعاد من الرئيس
    { from: 'RETURNED_COUNCIL', to: 'EXAM_IN_PROGRESS', actionCode: 'REEXAM', actionNameAr: 'إعادة الفحص', permissionCode: 'ASSIGN_EXAM', buttonColor: 'default', buttonIcon: 'ExperimentOutlined', sortOrder: 1 },
    { from: 'RETURNED_COUNCIL', to: 'PRESIDENT_REVIEW', actionCode: 'SUBMIT_TO_PRESIDENT', actionNameAr: 'إعادة الرفع للرئيس', permissionCode: 'SUBMIT_TO_PRESIDENT', buttonColor: 'primary', buttonIcon: 'SendOutlined', sortOrder: 2 },
    // الأجندة والاجتماع
    { from: 'IN_AGENDA_BOX', to: 'LINKED_TO_MEETING', actionCode: 'LINK_TO_MEETING', actionNameAr: 'ربط باجتماع', permissionCode: 'LINK_TO_MEETING', buttonColor: 'primary', buttonIcon: 'ScheduleOutlined', sortOrder: 1 },
    { from: 'LINKED_TO_MEETING', to: 'IN_AGENDA_BOX', actionCode: 'WITHDRAW', actionNameAr: 'سحب من الاجتماع', permissionCode: 'LINK_TO_MEETING', buttonColor: 'default', buttonIcon: 'UndoOutlined', sortOrder: 1 },
    { from: 'LINKED_TO_MEETING', to: 'DEFERRED_IN_SESSION', actionCode: 'DEFER', actionNameAr: 'تأجيل في الجلسة', permissionCode: 'REVIEW_AS_PRESIDENT', buttonColor: 'warning', buttonIcon: 'PauseCircleOutlined', sortOrder: 2 },
    { from: 'LINKED_TO_MEETING', to: 'DISCUSSED', actionCode: 'MARK_DISCUSSED', actionNameAr: 'تم النقاش', permissionCode: 'HOLD_MEETING', buttonColor: 'primary', buttonIcon: 'CheckOutlined', sortOrder: 3 },
    { from: 'DEFERRED_IN_SESSION', to: 'IN_AGENDA_BOX', actionCode: 'AUTO_RETURN', actionNameAr: 'إعادة تلقائية', permissionCode: 'MANAGE_AGENDA', autoTransition: true, sortOrder: 1 },
  ];

  for (const t of topicTransitions) {
    const fromId = ts[t.from];
    const toId = ts[t.to];
    if (!fromId || !toId) {
      console.log(`⚠️ Skipping transition ${t.from} → ${t.to} (${t.actionCode}): fromId=${fromId}, toId=${toId}`);
      continue;
    }
    const existing = await prisma.workflowTransition.findUnique({
      where: { workflowId_fromStateId_actionCode: { workflowId: topicWf.id, fromStateId: fromId, actionCode: t.actionCode } },
    });
    if (!existing) {
      await prisma.workflowTransition.create({
        data: {
          workflowId: topicWf.id,
          fromStateId: fromId,
          toStateId: toId,
          actionCode: t.actionCode,
          actionNameAr: t.actionNameAr,
          permissionCode: t.permissionCode,
          requiresReason: t.requiresReason || false,
          isHierarchical: t.isHierarchical || false,
          autoTransition: t.autoTransition || false,
          buttonColor: t.buttonColor || 'default',
          buttonIcon: t.buttonIcon || null,
          sortOrder: t.sortOrder,
        },
      });
    }
  }

  // ── 4.2 مسار الاجتماعات ──
  const meetingWf = await prisma.workflowDefinition.create({
    data: { code: 'MEETING_WORKFLOW', nameAr: 'مسار الاجتماعات', entityType: 'Meeting' },
  });

  const meetingStates = [
    { code: 'MEETING_DRAFT_SEC', nameAr: 'مسودة (أمين المجلس)', stateType: 'INITIAL', color: 'default', sortOrder: 1 },
    { code: 'MEETING_GS_APPROVAL', nameAr: 'بانتظار اعتماد الأمين', stateType: 'NORMAL', color: 'warning', sortOrder: 2 },
    { code: 'MEETING_BACK_SEC', nameAr: 'عاد لأمين المجلس', stateType: 'NORMAL', color: 'processing', sortOrder: 3 },
    { code: 'MEETING_PRES_APPROVAL', nameAr: 'بانتظار اعتماد الرئيس', stateType: 'NORMAL', color: 'warning', sortOrder: 4 },
    { code: 'MEETING_SCHEDULED', nameAr: 'مجدول', stateType: 'NORMAL', color: 'success', sortOrder: 5 },
    { code: 'MEETING_HELD', nameAr: 'انعقد', stateType: 'NORMAL', color: 'success', sortOrder: 6 },
    { code: 'MEETING_ADJOURNED', nameAr: 'مؤجل', stateType: 'NORMAL', color: 'warning', sortOrder: 7 },
    { code: 'MEETING_CANCELLED', nameAr: 'ملغي', stateType: 'FINAL', color: 'error', sortOrder: 8 },
  ];

  const ms: Record<string, string> = {};
  for (const s of meetingStates) {
    const created = await prisma.workflowState.create({ data: { workflowId: meetingWf.id, ...s } });
    ms[s.code] = created.id;
  }

  const meetingTransitions = [
    { from: 'MEETING_DRAFT_SEC', to: 'MEETING_GS_APPROVAL', actionCode: 'SEND_TO_GS', actionNameAr: 'إرسال للأمين العام', permissionCode: 'CREATE_MEETING', buttonColor: 'primary', buttonIcon: 'SendOutlined' },
    { from: 'MEETING_GS_APPROVAL', to: 'MEETING_BACK_SEC', actionCode: 'GS_APPROVE', actionNameAr: 'اعتماد', permissionCode: 'APPROVE_MEETING_GS', buttonColor: 'primary', buttonIcon: 'CheckOutlined' },
    { from: 'MEETING_GS_APPROVAL', to: 'MEETING_DRAFT_SEC', actionCode: 'GS_RETURN', actionNameAr: 'إعادة', permissionCode: 'APPROVE_MEETING_GS', requiresReason: true, buttonColor: 'default', buttonIcon: 'RollbackOutlined' },
    { from: 'MEETING_BACK_SEC', to: 'MEETING_PRES_APPROVAL', actionCode: 'SEND_TO_PRESIDENT', actionNameAr: 'إرسال للرئيس', permissionCode: 'CREATE_MEETING', buttonColor: 'primary', buttonIcon: 'SendOutlined' },
    { from: 'MEETING_PRES_APPROVAL', to: 'MEETING_SCHEDULED', actionCode: 'PRESIDENT_APPROVE', actionNameAr: 'اعتماد', permissionCode: 'APPROVE_MEETING_PRES', buttonColor: 'primary', buttonIcon: 'CheckOutlined' },
    { from: 'MEETING_PRES_APPROVAL', to: 'MEETING_BACK_SEC', actionCode: 'PRESIDENT_RETURN', actionNameAr: 'إعادة', permissionCode: 'APPROVE_MEETING_PRES', requiresReason: true, buttonColor: 'default', buttonIcon: 'RollbackOutlined' },
    { from: 'MEETING_SCHEDULED', to: 'MEETING_HELD', actionCode: 'HOLD', actionNameAr: 'عقد الاجتماع', permissionCode: 'HOLD_MEETING', buttonColor: 'primary', buttonIcon: 'CheckCircleOutlined' },
    { from: 'MEETING_SCHEDULED', to: 'MEETING_ADJOURNED', actionCode: 'ADJOURN', actionNameAr: 'تأجيل', permissionCode: 'HOLD_MEETING', buttonColor: 'warning', buttonIcon: 'PauseCircleOutlined' },
    { from: 'MEETING_SCHEDULED', to: 'MEETING_CANCELLED', actionCode: 'CANCEL', actionNameAr: 'إلغاء', permissionCode: 'CANCEL_MEETING', requiresReason: true, buttonColor: 'danger', buttonIcon: 'CloseOutlined' },
  ];

  for (const t of meetingTransitions) {
    await prisma.workflowTransition.create({
      data: {
        workflowId: meetingWf.id, fromStateId: ms[t.from], toStateId: ms[t.to],
        actionCode: t.actionCode, actionNameAr: t.actionNameAr, permissionCode: t.permissionCode,
        requiresReason: t.requiresReason || false, buttonColor: t.buttonColor || 'default',
        buttonIcon: t.buttonIcon || null, sortOrder: 0,
      },
    });
  }

  // ── 4.3 مسار المحاضر ──
  const minutesWf = await prisma.workflowDefinition.create({
    data: { code: 'MINUTES_WORKFLOW', nameAr: 'مسار المحاضر', entityType: 'Minutes' },
  });

  const minutesStates = [
    { code: 'MIN_DRAFT', nameAr: 'مسودة', stateType: 'INITIAL', color: 'default', sortOrder: 1 },
    { code: 'MIN_GS_REVIEW', nameAr: 'مراجعة الأمين', stateType: 'NORMAL', color: 'warning', sortOrder: 2 },
    { code: 'MIN_GS_RETURNED', nameAr: 'مُعاد من الأمين', stateType: 'NORMAL', color: 'error', sortOrder: 3 },
    { code: 'MIN_MEMBERS_CONSULT', nameAr: 'استشارة الأعضاء', stateType: 'NORMAL', color: 'processing', sortOrder: 4 },
    { code: 'MIN_TO_PRESIDENT', nameAr: 'لدى الرئيس للتوقيع', stateType: 'NORMAL', color: 'warning', sortOrder: 5 },
    { code: 'MIN_SIGNED', nameAr: 'موقّع', stateType: 'FINAL', color: 'success', sortOrder: 6 },
    { code: 'MIN_PRES_REJECT', nameAr: 'مرفوض من الرئيس', stateType: 'NORMAL', color: 'error', sortOrder: 7 },
  ];

  const mns: Record<string, string> = {};
  for (const s of minutesStates) {
    const created = await prisma.workflowState.create({ data: { workflowId: minutesWf.id, ...s } });
    mns[s.code] = created.id;
  }

  const minutesTransitions = [
    { from: 'MIN_DRAFT', to: 'MIN_GS_REVIEW', actionCode: 'SEND_TO_GS', actionNameAr: 'إرسال للأمين', permissionCode: 'CREATE_MINUTES', buttonColor: 'primary', buttonIcon: 'SendOutlined' },
    { from: 'MIN_GS_REVIEW', to: 'MIN_MEMBERS_CONSULT', actionCode: 'GS_APPROVE', actionNameAr: 'اعتماد', permissionCode: 'REVIEW_MINUTES_GS', buttonColor: 'primary', buttonIcon: 'CheckOutlined' },
    { from: 'MIN_GS_REVIEW', to: 'MIN_GS_RETURNED', actionCode: 'GS_RETURN', actionNameAr: 'إعادة', permissionCode: 'REVIEW_MINUTES_GS', requiresReason: true, buttonColor: 'default', buttonIcon: 'RollbackOutlined' },
    { from: 'MIN_GS_RETURNED', to: 'MIN_GS_REVIEW', actionCode: 'RESUBMIT_TO_GS', actionNameAr: 'إعادة الإرسال', permissionCode: 'CREATE_MINUTES', buttonColor: 'primary', buttonIcon: 'SendOutlined' },
    { from: 'MIN_MEMBERS_CONSULT', to: 'MIN_TO_PRESIDENT', actionCode: 'CLOSE_FEEDBACK', actionNameAr: 'إغلاق التصويت', permissionCode: 'CREATE_MINUTES', buttonColor: 'primary', buttonIcon: 'CheckOutlined' },
    { from: 'MIN_TO_PRESIDENT', to: 'MIN_SIGNED', actionCode: 'SIGN', actionNameAr: 'توقيع', permissionCode: 'SIGN_MINUTES', buttonColor: 'primary', buttonIcon: 'EditOutlined' },
    { from: 'MIN_TO_PRESIDENT', to: 'MIN_PRES_REJECT', actionCode: 'REJECT_SIGN', actionNameAr: 'رفض التوقيع', permissionCode: 'SIGN_MINUTES', requiresReason: true, buttonColor: 'danger', buttonIcon: 'CloseOutlined' },
    { from: 'MIN_PRES_REJECT', to: 'MIN_GS_REVIEW', actionCode: 'GS_REWORK', actionNameAr: 'إعادة المعالجة', permissionCode: 'REVIEW_MINUTES_GS', buttonColor: 'primary', buttonIcon: 'RedoOutlined' },
  ];

  for (const t of minutesTransitions) {
    await prisma.workflowTransition.create({
      data: {
        workflowId: minutesWf.id, fromStateId: mns[t.from], toStateId: mns[t.to],
        actionCode: t.actionCode, actionNameAr: t.actionNameAr, permissionCode: t.permissionCode,
        requiresReason: t.requiresReason || false, buttonColor: t.buttonColor || 'default',
        buttonIcon: t.buttonIcon || null, sortOrder: 0,
      },
    });
  }

  // ═══════════════════════════════════════════════
  // 5. الهيكل التنظيمي الشجري
  // ═══════════════════════════════════════════════
  console.log('🏢 الهيكل التنظيمي...');

  // المنظمة الجذر
  const rootOrg = await prisma.organizationUnit.create({
    data: { name: 'المنظمة', code: 'ROOT', level: 0, unitType: 'ORGANIZATION', isApprovalAuthority: false, sortOrder: 0 },
  });

  // وكالة التقنية (3 مستويات حتى الاعتماد)
  const techAgency = await prisma.organizationUnit.create({
    data: { name: 'وكالة التقنية', code: 'TECH_AGENCY', parentId: rootOrg.id, level: 1, unitType: 'AGENCY', isApprovalAuthority: true, sortOrder: 1 },
  });
  const infraDept = await prisma.organizationUnit.create({
    data: { name: 'إدارة البنية التحتية', code: 'INFRA_DEPT', parentId: techAgency.id, level: 2, unitType: 'DEPARTMENT', sortOrder: 1 },
  });
  const networkSec = await prisma.organizationUnit.create({
    data: { name: 'قسم الشبكات', code: 'NETWORK_SEC', parentId: infraDept.id, level: 3, unitType: 'SECTION', sortOrder: 1 },
  });
  const serverSec = await prisma.organizationUnit.create({
    data: { name: 'قسم السيرفرات', code: 'SERVER_SEC', parentId: infraDept.id, level: 3, unitType: 'SECTION', sortOrder: 2 },
  });
  const devDept = await prisma.organizationUnit.create({
    data: { name: 'إدارة التطوير', code: 'DEV_DEPT', parentId: techAgency.id, level: 2, unitType: 'DEPARTMENT', sortOrder: 2 },
  });
  const progSec = await prisma.organizationUnit.create({
    data: { name: 'قسم البرمجة', code: 'PROG_SEC', parentId: devDept.id, level: 3, unitType: 'SECTION', sortOrder: 1 },
  });

  // وكالة الموارد البشرية (مستوى واحد فقط)
  const hrAgency = await prisma.organizationUnit.create({
    data: { name: 'وكالة الموارد البشرية', code: 'HR_AGENCY', parentId: rootOrg.id, level: 1, unitType: 'AGENCY', isApprovalAuthority: true, sortOrder: 2 },
  });
  const recruitDept = await prisma.organizationUnit.create({
    data: { name: 'إدارة التوظيف', code: 'RECRUIT_DEPT', parentId: hrAgency.id, level: 2, unitType: 'DEPARTMENT', sortOrder: 1 },
  });

  // مكتب الأمين العام
  const gsOffice = await prisma.organizationUnit.create({
    data: { name: 'مكتب الأمين العام', code: 'GS_OFFICE', parentId: rootOrg.id, level: 1, unitType: 'DEPARTMENT', sortOrder: 3 },
  });

  // ═══════════════════════════════════════════════
  // 6. المجالس
  // ═══════════════════════════════════════════════
  console.log('🏛️  المجالس...');
  const councils = {
    tech: await prisma.council.create({ data: { name: 'مجلس التقنية', code: 'TECH' } }),
    hiring: await prisma.council.create({ data: { name: 'مجلس التوظيف', code: 'HIRING' } }),
    finance: await prisma.council.create({ data: { name: 'مجلس المالية', code: 'FINANCE' } }),
  };

  // ═══════════════════════════════════════════════
  // 7. المستخدمون
  // ═══════════════════════════════════════════════
  console.log('👤 المستخدمون...');

  // مدير النظام
  const admin = await prisma.user.create({
    data: { email: 'admin@company.sa', passwordHash: hash, displayName: 'مدير النظام', organizationId: rootOrg.id, maxClearanceId: sl.topSecret.id },
  });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: roles['SYSTEM_ADMIN'] } });

  // الأمين العام
  const gs = await prisma.user.create({
    data: { email: 'gs@company.sa', passwordHash: hash, displayName: 'د. خالد الأمين', organizationId: gsOffice.id, maxClearanceId: sl.topSecret.id },
  });
  await prisma.userRole.create({ data: { userId: gs.id, roleId: roles['GENERAL_SECRETARY'] } });

  // موظف مكتب الأمين
  const gsStaff = await prisma.user.create({
    data: { email: 'gs.staff@company.sa', passwordHash: hash, displayName: 'فهد العمري', organizationId: gsOffice.id, maxClearanceId: sl.topSecret.id },
  });
  await prisma.userRole.create({ data: { userId: gsStaff.id, roleId: roles['GS_OFFICE_STAFF'] } });

  // ── وكالة التقنية ──
  // وكيل التقنية (مسؤول الوكالة - نقطة الاعتماد النهائي)
  const techVP = await prisma.user.create({
    data: { email: 'tech.vp@company.sa', passwordHash: hash, displayName: 'م. سعود التقني', organizationId: techAgency.id, maxClearanceId: sl.topSecret.id },
  });
  await prisma.userRole.create({ data: { userId: techVP.id, roleId: roles['ORG_MANAGER'] } });
  await prisma.organizationUnit.update({ where: { id: techAgency.id }, data: { managerId: techVP.id } });

  // مدير البنية التحتية
  const infraMgr = await prisma.user.create({
    data: { email: 'infra.mgr@company.sa', passwordHash: hash, displayName: 'أحمد البنية', organizationId: infraDept.id, maxClearanceId: sl.confidential.id },
  });
  await prisma.userRole.create({ data: { userId: infraMgr.id, roleId: roles['ORG_MANAGER'] } });
  await prisma.organizationUnit.update({ where: { id: infraDept.id }, data: { managerId: infraMgr.id } });

  // رئيس قسم الشبكات
  const netMgr = await prisma.user.create({
    data: { email: 'net.mgr@company.sa', passwordHash: hash, displayName: 'عبدالله الشبكي', organizationId: networkSec.id, maxClearanceId: sl.internal.id },
  });
  await prisma.userRole.create({ data: { userId: netMgr.id, roleId: roles['ORG_MANAGER'] } });
  await prisma.organizationUnit.update({ where: { id: networkSec.id }, data: { managerId: netMgr.id } });

  // موظف في قسم الشبكات
  const netEmployee = await prisma.user.create({
    data: { email: 'net.emp@company.sa', passwordHash: hash, displayName: 'محمد الشبكي', organizationId: networkSec.id, maxClearanceId: sl.internal.id },
  });
  await prisma.userRole.create({ data: { userId: netEmployee.id, roleId: roles['EMPLOYEE'] } });

  // مدير التطوير
  const devMgr = await prisma.user.create({
    data: { email: 'dev.mgr@company.sa', passwordHash: hash, displayName: 'خالد المطور', organizationId: devDept.id, maxClearanceId: sl.confidential.id },
  });
  await prisma.userRole.create({ data: { userId: devMgr.id, roleId: roles['ORG_MANAGER'] } });
  await prisma.organizationUnit.update({ where: { id: devDept.id }, data: { managerId: devMgr.id } });

  // موظف في قسم البرمجة
  const progEmployee = await prisma.user.create({
    data: { email: 'prog.emp@company.sa', passwordHash: hash, displayName: 'سارة المبرمجة', organizationId: progSec.id, maxClearanceId: sl.internal.id },
  });
  await prisma.userRole.create({ data: { userId: progEmployee.id, roleId: roles['EMPLOYEE'] } });

  // ── وكالة الموارد البشرية ──
  const hrVP = await prisma.user.create({
    data: { email: 'hr.vp@company.sa', passwordHash: hash, displayName: 'نورة الموارد', organizationId: hrAgency.id, maxClearanceId: sl.confidential.id },
  });
  await prisma.userRole.create({ data: { userId: hrVP.id, roleId: roles['ORG_MANAGER'] } });
  await prisma.organizationUnit.update({ where: { id: hrAgency.id }, data: { managerId: hrVP.id } });

  const recruitMgr = await prisma.user.create({
    data: { email: 'recruit.mgr@company.sa', passwordHash: hash, displayName: 'هند التوظيف', organizationId: recruitDept.id, maxClearanceId: sl.internal.id },
  });
  await prisma.userRole.create({ data: { userId: recruitMgr.id, roleId: roles['ORG_MANAGER'] } });
  await prisma.organizationUnit.update({ where: { id: recruitDept.id }, data: { managerId: recruitMgr.id } });

  const hrEmployee = await prisma.user.create({
    data: { email: 'hr.emp@company.sa', passwordHash: hash, displayName: 'ريم التوظيف', organizationId: recruitDept.id, maxClearanceId: sl.internal.id },
  });
  await prisma.userRole.create({ data: { userId: hrEmployee.id, roleId: roles['EMPLOYEE'] } });

  // ── أدوار المجالس ──
  // أمين مجلس التقنية
  const techSecretary = await prisma.user.create({
    data: { email: 'tech.sec@company.sa', passwordHash: hash, displayName: 'عمر أمين التقنية', organizationId: rootOrg.id, maxClearanceId: sl.topSecret.id },
  });
  await prisma.userRole.create({ data: { userId: techSecretary.id, roleId: roles['COUNCIL_SECRETARY'], councilId: councils.tech.id } });

  // رئيس مجلس التقنية
  const techPresident = await prisma.user.create({
    data: { email: 'tech.pres@company.sa', passwordHash: hash, displayName: 'د. فيصل رئيس التقنية', organizationId: rootOrg.id, maxClearanceId: sl.topSecret.id },
  });
  await prisma.userRole.create({ data: { userId: techPresident.id, roleId: roles['COUNCIL_PRESIDENT'], councilId: councils.tech.id } });

  // أعضاء مجلس التقنية
  const techMember1 = await prisma.user.create({
    data: { email: 'tech.m1@company.sa', passwordHash: hash, displayName: 'سلطان عضو التقنية', organizationId: rootOrg.id, maxClearanceId: sl.confidential.id },
  });
  await prisma.userRole.create({ data: { userId: techMember1.id, roleId: roles['COUNCIL_MEMBER'], councilId: councils.tech.id } });

  // فاحص مجلس التقنية
  const techExaminer = await prisma.user.create({
    data: { email: 'tech.exam@company.sa', passwordHash: hash, displayName: 'ماجد فاحص التقنية', organizationId: rootOrg.id, maxClearanceId: sl.topSecret.id },
  });
  await prisma.userRole.create({ data: { userId: techExaminer.id, roleId: roles['EXAM_OFFICER'], councilId: councils.tech.id } });

  // ═══════════════════════════════════════════════
  // 8. تهيئة النظام
  // ═══════════════════════════════════════════════
  console.log('⚙️  تهيئة النظام...');
  const configs = [
    { key: 'ORG_NAME_AR', value: 'المنظمة', description: 'اسم المنظمة بالعربي' },
    { key: 'DEFAULT_PAGE_SIZE', value: '20', valueType: 'INT', description: 'عدد العناصر الافتراضي بالصفحة' },
    { key: 'FEEDBACK_DEADLINE_DAYS', value: '5', valueType: 'INT', description: 'مهلة مرئيات الأعضاء (أيام)' },
  ];
  for (const c of configs) {
    await prisma.systemConfig.create({ data: c });
  }

  // ═══════════════════════════════════════════════
  console.log('\n✅ تم توليد البيانات بنجاح!\n');
  console.log('═══════════════════════════════════════════════');
  console.log('  بيانات الدخول (كلمة المرور: Admin@123)');
  console.log('═══════════════════════════════════════════════');
  console.log('  مدير النظام:        admin@company.sa');
  console.log('  الأمين العام:       gs@company.sa');
  console.log('  موظف مكتب الأمين:  gs.staff@company.sa');
  console.log('  ─────────────────────────────────────');
  console.log('  وكالة التقنية:');
  console.log('    وكيل التقنية:     tech.vp@company.sa');
  console.log('    مدير البنية:      infra.mgr@company.sa');
  console.log('    رئيس قسم الشبكات: net.mgr@company.sa');
  console.log('    موظف شبكات:       net.emp@company.sa');
  console.log('    مدير التطوير:     dev.mgr@company.sa');
  console.log('    موظفة برمجة:      prog.emp@company.sa');
  console.log('  ─────────────────────────────────────');
  console.log('  وكالة الموارد البشرية:');
  console.log('    وكيل الموارد:     hr.vp@company.sa');
  console.log('    مدير التوظيف:     recruit.mgr@company.sa');
  console.log('    موظفة توظيف:      hr.emp@company.sa');
  console.log('  ─────────────────────────────────────');
  console.log('  مجلس التقنية:');
  console.log('    أمين المجلس:      tech.sec@company.sa');
  console.log('    رئيس المجلس:      tech.pres@company.sa');
  console.log('    عضو مجلس:         tech.m1@company.sa');
  console.log('    فاحص:             tech.exam@company.sa');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log('  سيناريو الاختبار (وكالة التقنية - 3 مستويات):');
  console.log('  net.emp ينشئ موضوع → net.mgr يعتمد → infra.mgr يعتمد → tech.vp يعتمد → gs يقبل → المجلس');
  console.log('');
  console.log('  سيناريو الاختبار (وكالة الموارد - مستوى واحد):');
  console.log('  hr.emp ينشئ موضوع → recruit.mgr يعتمد → hr.vp يعتمد → gs يقبل → المجلس');
  console.log('═══════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ خطأ:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
