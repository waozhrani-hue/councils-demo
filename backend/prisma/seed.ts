import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════
// بيانات الاختبار الشاملة — تغطي كل مسار عمل وكل دور
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('\n🔄 بدء توليد بيانات الاختبار...\n');

  // ─── تنظيف البيانات القديمة (باستخدام PostgreSQL TRUNCATE CASCADE) ───
  console.log('🗑️  تنظيف البيانات القديمة...');
  const tableNames = [
    'AuditLog', 'NotificationDeliveryAttempt', 'Notification', 'Decision',
    'MinuteMemberFeedback', 'Minutes', 'MeetingTopicLink', 'Meeting',
    'Examination', 'GSReview', 'TopicStatusLog', 'TopicAttachment', 'Topic',
    'Delegation', 'SystemConfig', 'UserRole', 'Role', 'User',
    'Council', 'OrganizationUnit', 'SecretLevel',
  ];
  for (const t of tableNames) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" CASCADE`);
  }
  console.log('✅ تم التنظيف');

  const hash = await bcrypt.hash('Admin@123', 10);

  // ─── مستويات السرية ───
  const sl = {
    public: await prisma.secretLevel.create({ data: { name: 'عام', sortOrder: 1 } }),
    internal: await prisma.secretLevel.create({ data: { name: 'داخلي', sortOrder: 2 } }),
    confidential: await prisma.secretLevel.create({ data: { name: 'سري', sortOrder: 3 } }),
    top: await prisma.secretLevel.create({ data: { name: 'سري للغاية', sortOrder: 4 } }),
  };

  // ─── الأدوار ───
  const roleDefs = [
    { code: 'SYSTEM_ADMIN', labelAr: 'مدير النظام' },
    { code: 'DEPT_STAFF', labelAr: 'موظف إدارة' },
    { code: 'DEPT_MANAGER', labelAr: 'مدير إدارة' },
    { code: 'GENERAL_SECRETARY', labelAr: 'الأمين العام' },
    { code: 'GS_OFFICE_STAFF', labelAr: 'موظف مكتب الأمين العام' },
    { code: 'EXAM_OFFICER', labelAr: 'مسؤول الفحص' },
    { code: 'COUNCIL_SECRETARY', labelAr: 'أمين المجلس' },
    { code: 'COUNCIL_PRESIDENT', labelAr: 'رئيس المجلس' },
    { code: 'COUNCIL_MEMBER', labelAr: 'عضو مجلس' },
    { code: 'COUNCIL_STAFF', labelAr: 'موظف مجلس' },
  ];
  const roles: Record<string, any> = {};
  for (const r of roleDefs) {
    roles[r.code] = await prisma.role.create({ data: r });
  }

  // ─── الوحدات التنظيمية ───
  const orgs: Record<string, any> = {};
  const orgDefs = [
    { code: 'GS_OFFICE', name: 'مكتب الأمين العام' },
    { code: 'IT_DEPT', name: 'إدارة تقنية المعلومات' },
    { code: 'HR_DEPT', name: 'إدارة الموارد البشرية' },
    { code: 'FIN_DEPT', name: 'إدارة الشؤون المالية' },
    { code: 'OPS_DEPT', name: 'إدارة التشغيل' },
    { code: 'MKT_DEPT', name: 'إدارة التسويق' },
  ];
  for (const o of orgDefs) {
    orgs[o.code] = await prisma.organizationUnit.create({ data: { name: o.name, code: o.code } });
  }

  // ─── المجالس ───
  const councils: Record<string, any> = {};
  const councilDefs = [
    { code: 'TECH', name: 'مجلس التقنية' },
    { code: 'HIRING', name: 'مجلس التوظيف' },
    { code: 'FINANCE', name: 'مجلس المالية' },
  ];
  for (const c of councilDefs) {
    councils[c.code] = await prisma.council.create({ data: { name: c.name, code: c.code } });
  }

  // ─── إنشاء المستخدمين ───
  async function createUser(
    email: string,
    displayName: string,
    orgCode: string,
    clearanceId: string,
    userRoles: { roleCode: string; councilCode?: string }[],
  ) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        displayName,
        organizationId: orgs[orgCode].id,
        maxClearanceId: clearanceId,
      },
    });
    for (const ur of userRoles) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: roles[ur.roleCode].id,
          councilId: ur.councilCode ? councils[ur.councilCode].id : null,
        },
      });
    }
    return user;
  }

  // ══════════════════════════════════════════════
  // المستخدمون — مستخدم واحد على الأقل لكل دور
  // ══════════════════════════════════════════════

  const users: Record<string, any> = {};

  // مدير النظام
  users.admin = await createUser('admin@company.sa', 'أحمد المدير', 'GS_OFFICE', sl.top.id, [
    { roleCode: 'SYSTEM_ADMIN' },
  ]);

  // الأمين العام
  users.gs = await createUser('gs@company.sa', 'د. خالد الأمين', 'GS_OFFICE', sl.top.id, [
    { roleCode: 'GENERAL_SECRETARY' },
  ]);

  // موظف مكتب الأمين العام
  users.gsStaff = await createUser('gs.staff@company.sa', 'نورة العتيبي', 'GS_OFFICE', sl.top.id, [
    { roleCode: 'GS_OFFICE_STAFF' },
  ]);

  // ─── إدارة تقنية المعلومات ───
  users.itStaff = await createUser('it.staff@company.sa', 'محمد التقني', 'IT_DEPT', sl.internal.id, [
    { roleCode: 'DEPT_STAFF' },
  ]);
  users.itManager = await createUser('it.manager@company.sa', 'سعود المدير', 'IT_DEPT', sl.confidential.id, [
    { roleCode: 'DEPT_MANAGER' },
  ]);

  // ─── إدارة الموارد البشرية ───
  users.hrStaff = await createUser('hr.staff@company.sa', 'فاطمة الموظفة', 'HR_DEPT', sl.internal.id, [
    { roleCode: 'DEPT_STAFF' },
  ]);
  users.hrManager = await createUser('hr.manager@company.sa', 'عبدالله المدير', 'HR_DEPT', sl.confidential.id, [
    { roleCode: 'DEPT_MANAGER' },
  ]);

  // ─── إدارة الشؤون المالية ───
  users.finStaff = await createUser('fin.staff@company.sa', 'هند المالية', 'FIN_DEPT', sl.internal.id, [
    { roleCode: 'DEPT_STAFF' },
  ]);
  users.finManager = await createUser('fin.manager@company.sa', 'ياسر المالي', 'FIN_DEPT', sl.confidential.id, [
    { roleCode: 'DEPT_MANAGER' },
  ]);

  // ─── أمناء المجالس ───
  users.techSec = await createUser('tech.sec@company.sa', 'فهد السالم', 'GS_OFFICE', sl.top.id, [
    { roleCode: 'COUNCIL_SECRETARY', councilCode: 'TECH' },
  ]);
  users.hireSec = await createUser('hire.sec@company.sa', 'سارة المالكي', 'GS_OFFICE', sl.top.id, [
    { roleCode: 'COUNCIL_SECRETARY', councilCode: 'HIRING' },
  ]);
  users.finSec = await createUser('fin.sec@company.sa', 'هدى الزهراني', 'GS_OFFICE', sl.top.id, [
    { roleCode: 'COUNCIL_SECRETARY', councilCode: 'FINANCE' },
  ]);

  // ─── رؤساء المجالس ───
  users.techPres = await createUser('tech.pres@company.sa', 'د. عمر الرئيس', 'GS_OFFICE', sl.top.id, [
    { roleCode: 'COUNCIL_PRESIDENT', councilCode: 'TECH' },
  ]);
  users.hirePres = await createUser('hire.pres@company.sa', 'د. منى الرئيسة', 'GS_OFFICE', sl.top.id, [
    { roleCode: 'COUNCIL_PRESIDENT', councilCode: 'HIRING' },
  ]);
  users.finPres = await createUser('fin.pres@company.sa', 'د. صالح الرئيس', 'GS_OFFICE', sl.top.id, [
    { roleCode: 'COUNCIL_PRESIDENT', councilCode: 'FINANCE' },
  ]);

  // ─── مسؤولو الفحص ───
  users.techExam = await createUser('tech.exam@company.sa', 'خالد الفاحص', 'GS_OFFICE', sl.top.id, [
    { roleCode: 'EXAM_OFFICER', councilCode: 'TECH' },
  ]);
  users.hireExam = await createUser('hire.exam@company.sa', 'ريم الفاحصة', 'GS_OFFICE', sl.top.id, [
    { roleCode: 'EXAM_OFFICER', councilCode: 'HIRING' },
  ]);

  // ─── أعضاء مجالس ───
  users.techMember1 = await createUser('tech.m1@company.sa', 'ماجد العضو', 'GS_OFFICE', sl.confidential.id, [
    { roleCode: 'COUNCIL_MEMBER', councilCode: 'TECH' },
  ]);
  users.techMember2 = await createUser('tech.m2@company.sa', 'لمى العضوة', 'GS_OFFICE', sl.confidential.id, [
    { roleCode: 'COUNCIL_MEMBER', councilCode: 'TECH' },
  ]);
  users.hireMember1 = await createUser('hire.m1@company.sa', 'طارق العضو', 'GS_OFFICE', sl.confidential.id, [
    { roleCode: 'COUNCIL_MEMBER', councilCode: 'HIRING' },
  ]);

  // ─── موظفو المجالس (دعم إداري) ───
  users.techStaff = await createUser('tech.staff@company.sa', 'عبير المساعدة', 'GS_OFFICE', sl.internal.id, [
    { roleCode: 'COUNCIL_STAFF', councilCode: 'TECH' },
  ]);
  users.hireStaff = await createUser('hire.staff@company.sa', 'مها المساعدة', 'GS_OFFICE', sl.internal.id, [
    { roleCode: 'COUNCIL_STAFF', councilCode: 'HIRING' },
  ]);

  // ══════════════════════════════════════════════════════
  // مسارات العمل — كل مسار يمثل حالة اختبار مختلفة
  // ══════════════════════════════════════════════════════

  let topicSeq = 0;
  const allTopics: any[] = [];

  async function createTopicAtStatus(
    title: string,
    councilCode: string,
    orgCode: string,
    createdBy: any,
    targetStatus: string,
    statusPath: { status: string; action: string; actor: any; reason?: string; returnType?: string }[],
  ) {
    topicSeq++;
    const refNumber = `TOP-2026-${String(topicSeq).padStart(5, '0')}`;

    const topic = await prisma.topic.create({
      data: {
        refNumber,
        title,
        status: targetStatus,
        councilId: councils[councilCode].id,
        secrecyLevelId: sl.internal.id,
        requestingOrgId: orgs[orgCode].id,
        createdById: createdBy.id,
        currentVersion: statusPath.length + 1,
        returnType: statusPath.find((s) => s.returnType)?.returnType || null,
        agendaEnteredAt: targetStatus === 'IN_AGENDA_BOX' ? new Date() : null,
      },
    });

    // Create status logs for the full path
    let version = 1;
    let prevStatus: string | null = null;
    for (const step of statusPath) {
      version++;
      await prisma.topicStatusLog.create({
        data: {
          topicId: topic.id,
          fromStatus: prevStatus || 'DRAFT',
          toStatus: step.status,
          action: step.action,
          actorId: step.actor.id,
          reason: step.reason,
          version,
          createdAt: new Date(Date.now() - (statusPath.length - version) * 3600000),
        },
      });
      prevStatus = step.status;
    }

    allTopics.push(topic);
    return topic;
  }

  // ──────────────────────────────────────────────────────
  // المسار 1: DRAFT — ينتظر إجراء الموظف (SUBMIT_TO_MANAGER)
  // الدور: DEPT_STAFF — it.staff@company.sa
  // ──────────────────────────────────────────────────────
  await createTopicAtStatus(
    'مسودة: طلب شراء أجهزة حاسب جديدة',
    'TECH', 'IT_DEPT', users.itStaff,
    'DRAFT', [],
  );
  await createTopicAtStatus(
    'مسودة: تحديث نظام البريد الإلكتروني',
    'TECH', 'IT_DEPT', users.itStaff,
    'DRAFT', [],
  );

  // ──────────────────────────────────────────────────────
  // المسار 2: PENDING_DEPT_MGR — ينتظر إجراء المدير (APPROVE / RETURN_TO_DRAFT)
  // الدور: DEPT_MANAGER — it.manager@company.sa
  // ──────────────────────────────────────────────────────
  await createTopicAtStatus(
    'بانتظار الاعتماد: مشروع التحول الرقمي',
    'TECH', 'IT_DEPT', users.itStaff,
    'PENDING_DEPT_MGR',
    [{ status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff }],
  );
  await createTopicAtStatus(
    'بانتظار الاعتماد: تجديد تراخيص البرمجيات',
    'TECH', 'IT_DEPT', users.itStaff,
    'PENDING_DEPT_MGR',
    [{ status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff }],
  );
  // From HR dept too
  await createTopicAtStatus(
    'بانتظار الاعتماد: خطة التدريب السنوية',
    'HIRING', 'HR_DEPT', users.hrStaff,
    'PENDING_DEPT_MGR',
    [{ status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.hrStaff }],
  );

  // ──────────────────────────────────────────────────────
  // المسار 3: APPROVED — ينتظر إجراء المدير (SEND_TO_GS / REVOKE_APPROVAL)
  // الدور: DEPT_MANAGER
  // ──────────────────────────────────────────────────────
  await createTopicAtStatus(
    'معتمد: طلب توظيف مطورين',
    'HIRING', 'IT_DEPT', users.itStaff,
    'APPROVED',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
    ],
  );
  await createTopicAtStatus(
    'معتمد: ميزانية مشروع الشبكات',
    'FINANCE', 'IT_DEPT', users.itStaff,
    'APPROVED',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
    ],
  );

  // ──────────────────────────────────────────────────────
  // المسار 4: GS_REVIEW — ينتظر إجراء الأمين العام (ACCEPT / SUSPEND / REJECT)
  // الدور: GENERAL_SECRETARY — gs@company.sa
  // ──────────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const titles = [
      'مراجعة الأمين: اعتماد هيكل تنظيمي جديد',
      'مراجعة الأمين: سياسة الأمن السيبراني',
      'مراجعة الأمين: تحديث نظام ERP',
      'مراجعة الأمين: عقد صيانة المباني',
      'مراجعة الأمين: خطة التوسع الإقليمي',
    ];
    const councilCodes = ['TECH', 'HIRING', 'FINANCE', 'TECH', 'HIRING'];
    await createTopicAtStatus(
      titles[i], councilCodes[i], 'IT_DEPT', users.itStaff,
      'GS_REVIEW',
      [
        { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
        { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
        { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
        { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      ],
    );
  }

  // ──────────────────────────────────────────────────────
  // المسار 5: SUSPENDED — ينتظر إجراء الأمين العام (RESUME)
  // الدور: GENERAL_SECRETARY
  // ──────────────────────────────────────────────────────
  await createTopicAtStatus(
    'معلّق: مراجعة عقود التأمين',
    'FINANCE', 'HR_DEPT', users.hrStaff,
    'SUSPENDED',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.hrStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.hrManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.hrManager },
      { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      { status: 'SUSPENDED', action: 'SUSPEND', actor: users.gs, reason: 'بانتظار مستندات إضافية' },
    ],
  );
  await createTopicAtStatus(
    'معلّق: طلب تمويل بحث وتطوير',
    'TECH', 'IT_DEPT', users.itStaff,
    'SUSPENDED',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
      { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      { status: 'SUSPENDED', action: 'SUSPEND', actor: users.gs, reason: 'يتطلب دراسة مالية إضافية' },
    ],
  );

  // ──────────────────────────────────────────────────────
  // المسار 6: RETURNED_DEPT — ينتظر إجراء المدير (RESUBMIT / CLOSE_BY_DEPT)
  // الدور: DEPT_MANAGER
  // ──────────────────────────────────────────────────────
  await createTopicAtStatus(
    'مُعاد: طلب شراء نظام محاسبي',
    'FINANCE', 'FIN_DEPT', users.finStaff,
    'RETURNED_DEPT',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.finStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.finManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.finManager },
      { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      { status: 'RETURNED_DEPT', action: 'REJECT', actor: users.gs, reason: 'يحتاج مواصفات تفصيلية' },
    ],
  );
  await createTopicAtStatus(
    'مُعاد: طلب إنشاء وحدة ابتكار',
    'TECH', 'IT_DEPT', users.itStaff,
    'RETURNED_DEPT',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
      { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      { status: 'RETURNED_DEPT', action: 'RETURN_WRONG_COUNCIL', actor: users.gs, reason: 'يجب تحويله لمجلس التوظيف' },
    ],
  );

  // ──────────────────────────────────────────────────────
  // المسار 7: WITH_COUNCIL — ينتظر إجراء أمين المجلس (ASSIGN_EXAM)
  // الدور: COUNCIL_SECRETARY — tech.sec@company.sa
  // ──────────────────────────────────────────────────────
  for (const [title, council] of [
    ['لدى المجلس: اعتماد ميزانية التحول الرقمي', 'TECH'],
    ['لدى المجلس: تطوير بوابة الخدمات الإلكترونية', 'TECH'],
    ['لدى المجلس: خطة التوظيف السنوية', 'HIRING'],
    ['لدى المجلس: مراجعة الميزانية التشغيلية', 'FINANCE'],
  ] as const) {
    await createTopicAtStatus(
      title, council, 'IT_DEPT', users.itStaff,
      'WITH_COUNCIL',
      [
        { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
        { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
        { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
        { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
        { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
      ],
    );
  }

  // ──────────────────────────────────────────────────────
  // المسار 8: EXAM_IN_PROGRESS — ينتظر إجراء الفاحص (EXAM_PASS / EXAM_FAIL)
  // الدور: EXAM_OFFICER — tech.exam@company.sa
  // ──────────────────────────────────────────────────────
  const examTopics: any[] = [];
  for (const [title, council, sec, exam] of [
    ['قيد الفحص: سياسة العمل عن بُعد', 'TECH', users.techSec, users.techExam],
    ['قيد الفحص: نظام تقييم الأداء', 'TECH', users.techSec, users.techExam],
    ['قيد الفحص: عقود التوظيف الجديدة', 'HIRING', users.hireSec, users.hireExam],
  ] as const) {
    const t = await createTopicAtStatus(
      title as string, council as string, 'IT_DEPT', users.itStaff,
      'EXAM_IN_PROGRESS',
      [
        { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
        { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
        { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
        { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
        { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
        { status: 'EXAM_IN_PROGRESS', action: 'ASSIGN_EXAM', actor: sec },
      ],
    );
    // Create examination record
    await prisma.examination.create({
      data: {
        topicId: t.id,
        examinerId: (exam as any).id,
        assignedById: (sec as any).id,
        result: 'INCOMPLETE',
        version: t.currentVersion,
      },
    });
    examTopics.push(t);
  }

  // ──────────────────────────────────────────────────────
  // المسار 9: EXAM_INCOMPLETE — ينتظر إجراء أمين المجلس (REEXAM)
  // الدور: COUNCIL_SECRETARY
  // ──────────────────────────────────────────────────────
  const examIncomplete = await createTopicAtStatus(
    'فحص غير مكتمل: تحديث البنية التحتية للشبكات',
    'TECH', 'IT_DEPT', users.itStaff,
    'EXAM_INCOMPLETE',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
      { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
      { status: 'EXAM_IN_PROGRESS', action: 'ASSIGN_EXAM', actor: users.techSec },
      { status: 'EXAM_INCOMPLETE', action: 'EXAM_FAIL', actor: users.techExam, reason: 'المستندات الفنية ناقصة' },
    ],
  );
  await prisma.examination.create({
    data: {
      topicId: examIncomplete.id,
      examinerId: users.techExam.id,
      assignedById: users.techSec.id,
      result: 'INCOMPLETE',
      reasons: 'المستندات الفنية ناقصة',
      version: examIncomplete.currentVersion,
    },
  });

  // ──────────────────────────────────────────────────────
  // المسار 10: EXAM_COMPLETE — ينتظر إجراء أمين المجلس (SUBMIT_TO_PRESIDENT)
  // الدور: COUNCIL_SECRETARY
  // ──────────────────────────────────────────────────────
  const examComplete = await createTopicAtStatus(
    'فحص مكتمل: اعتماد خطة الطوارئ',
    'TECH', 'IT_DEPT', users.itStaff,
    'EXAM_COMPLETE',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
      { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
      { status: 'EXAM_IN_PROGRESS', action: 'ASSIGN_EXAM', actor: users.techSec },
      { status: 'EXAM_COMPLETE', action: 'EXAM_PASS', actor: users.techExam },
    ],
  );
  await prisma.examination.create({
    data: {
      topicId: examComplete.id,
      examinerId: users.techExam.id,
      assignedById: users.techSec.id,
      result: 'COMPLETE',
      version: examComplete.currentVersion,
    },
  });
  // Another one for HIRING
  const examComplete2 = await createTopicAtStatus(
    'فحص مكتمل: سياسة الاستقطاب',
    'HIRING', 'HR_DEPT', users.hrStaff,
    'EXAM_COMPLETE',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.hrStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.hrManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.hrManager },
      { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
      { status: 'EXAM_IN_PROGRESS', action: 'ASSIGN_EXAM', actor: users.hireSec },
      { status: 'EXAM_COMPLETE', action: 'EXAM_PASS', actor: users.hireExam },
    ],
  );
  await prisma.examination.create({
    data: {
      topicId: examComplete2.id,
      examinerId: users.hireExam.id,
      assignedById: users.hireSec.id,
      result: 'COMPLETE',
      version: examComplete2.currentVersion,
    },
  });

  // ──────────────────────────────────────────────────────
  // المسار 11: PRESIDENT_REVIEW — ينتظر إجراء الرئيس (MARK_SUITABLE / RETURN_TO_COUNCIL)
  // الدور: COUNCIL_PRESIDENT — tech.pres@company.sa
  // ──────────────────────────────────────────────────────
  for (const [title, council, sec, exam, pres] of [
    ['مراجعة الرئيس: مشروع البنية التحتية السحابية', 'TECH', users.techSec, users.techExam, users.techPres],
    ['مراجعة الرئيس: خطة تطوير الكوادر', 'HIRING', users.hireSec, users.hireExam, users.hirePres],
    ['مراجعة الرئيس: نظام المشتريات الإلكتروني', 'TECH', users.techSec, users.techExam, users.techPres],
  ] as const) {
    const t = await createTopicAtStatus(
      title as string, council as string, 'IT_DEPT', users.itStaff,
      'PRESIDENT_REVIEW',
      [
        { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
        { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
        { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
        { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
        { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
        { status: 'EXAM_IN_PROGRESS', action: 'ASSIGN_EXAM', actor: sec },
        { status: 'EXAM_COMPLETE', action: 'EXAM_PASS', actor: exam },
        { status: 'PRESIDENT_REVIEW', action: 'SUBMIT_TO_PRESIDENT', actor: sec },
      ],
    );
    await prisma.examination.create({
      data: {
        topicId: t.id,
        examinerId: (exam as any).id,
        assignedById: (sec as any).id,
        result: 'COMPLETE',
        version: t.currentVersion - 1,
      },
    });
  }

  // ──────────────────────────────────────────────────────
  // المسار 12: RETURNED_COUNCIL — ينتظر إجراء أمين المجلس (REEXAM أو SUBMIT_TO_PRESIDENT)
  // الدور: COUNCIL_SECRETARY
  // ──────────────────────────────────────────────────────
  // 12a: FULL_REEXAM
  const retCouncil1 = await createTopicAtStatus(
    'مُعاد للمجلس (إعادة فحص): تطوير منصة التعلم',
    'TECH', 'IT_DEPT', users.itStaff,
    'RETURNED_COUNCIL',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
      { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
      { status: 'EXAM_IN_PROGRESS', action: 'ASSIGN_EXAM', actor: users.techSec },
      { status: 'EXAM_COMPLETE', action: 'EXAM_PASS', actor: users.techExam },
      { status: 'PRESIDENT_REVIEW', action: 'SUBMIT_TO_PRESIDENT', actor: users.techSec },
      { status: 'RETURNED_COUNCIL', action: 'RETURN_TO_COUNCIL', actor: users.techPres, reason: 'يحتاج فحص فني أعمق', returnType: 'FULL_REEXAM' },
    ],
  );

  // 12b: PATH_CORRECTION
  const retCouncil2 = await createTopicAtStatus(
    'مُعاد للمجلس (تصحيح): سياسة أمن المعلومات',
    'TECH', 'IT_DEPT', users.itStaff,
    'RETURNED_COUNCIL',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
      { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
      { status: 'EXAM_IN_PROGRESS', action: 'ASSIGN_EXAM', actor: users.techSec },
      { status: 'EXAM_COMPLETE', action: 'EXAM_PASS', actor: users.techExam },
      { status: 'PRESIDENT_REVIEW', action: 'SUBMIT_TO_PRESIDENT', actor: users.techSec },
      { status: 'RETURNED_COUNCIL', action: 'RETURN_TO_COUNCIL', actor: users.techPres, reason: 'تصحيح بسيط في المرفقات', returnType: 'PATH_CORRECTION' },
    ],
  );

  // ──────────────────────────────────────────────────────
  // المسار 13: IN_AGENDA_BOX — ينتظر ربط باجتماع
  // الدور: COUNCIL_SECRETARY
  // ──────────────────────────────────────────────────────
  const agendaTopics: any[] = [];
  for (const [title, council] of [
    ['في الأجندة: اعتماد معايير الجودة', 'TECH'],
    ['في الأجندة: خطة التعاقب الوظيفي', 'TECH'],
    ['في الأجندة: نظام الحوافز الجديد', 'HIRING'],
    ['في الأجندة: ميزانية المشاريع الرأسمالية', 'FINANCE'],
  ] as const) {
    const sec = council === 'TECH' ? users.techSec : council === 'HIRING' ? users.hireSec : users.finSec;
    const exam = council === 'TECH' ? users.techExam : council === 'HIRING' ? users.hireExam : users.techExam;
    const pres = council === 'TECH' ? users.techPres : council === 'HIRING' ? users.hirePres : users.finPres;
    const t = await createTopicAtStatus(
      title as string, council as string, 'IT_DEPT', users.itStaff,
      'IN_AGENDA_BOX',
      [
        { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
        { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
        { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
        { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
        { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
        { status: 'EXAM_IN_PROGRESS', action: 'ASSIGN_EXAM', actor: sec },
        { status: 'EXAM_COMPLETE', action: 'EXAM_PASS', actor: exam },
        { status: 'PRESIDENT_REVIEW', action: 'SUBMIT_TO_PRESIDENT', actor: sec },
        { status: 'IN_AGENDA_BOX', action: 'MARK_SUITABLE', actor: pres },
      ],
    );
    agendaTopics.push(t);
  }

  // ──────────────────────────────────────────────────────
  // المسار 14: LINKED_TO_MEETING — ينتظر إجراء (WITHDRAW / DEFER)
  // ──────────────────────────────────────────────────────
  const linkedTopic = await createTopicAtStatus(
    'مرتبط باجتماع: استراتيجية الذكاء الاصطناعي',
    'TECH', 'IT_DEPT', users.itStaff,
    'LINKED_TO_MEETING',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
      { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
      { status: 'EXAM_IN_PROGRESS', action: 'ASSIGN_EXAM', actor: users.techSec },
      { status: 'EXAM_COMPLETE', action: 'EXAM_PASS', actor: users.techExam },
      { status: 'PRESIDENT_REVIEW', action: 'SUBMIT_TO_PRESIDENT', actor: users.techSec },
      { status: 'IN_AGENDA_BOX', action: 'MARK_SUITABLE', actor: users.techPres },
      { status: 'LINKED_TO_MEETING', action: 'LINK_TO_MEETING', actor: users.techSec },
    ],
  );

  // ══════════════════════════════════════════════════════
  // الاجتماعات — بحالات مختلفة
  // ══════════════════════════════════════════════════════

  // Meeting in DRAFT state
  const mtgDraft = await prisma.meeting.create({
    data: {
      refNumber: 'MTG-TECH-2026-001',
      councilId: councils.TECH.id,
      title: 'اجتماع مجلس التقنية الدوري (مسودة)',
      status: 'MEETING_DRAFT_SEC',
      scheduledAt: new Date('2026-05-01T10:00:00'),
      location: 'قاعة الاجتماعات الرئيسية',
      createdById: users.techSec.id,
    },
  });

  // Meeting awaiting GS approval
  const mtgGS = await prisma.meeting.create({
    data: {
      refNumber: 'MTG-TECH-2026-002',
      councilId: councils.TECH.id,
      title: 'اجتماع مجلس التقنية الاستثنائي (بانتظار الأمين)',
      status: 'MEETING_GS_APPROVAL',
      scheduledAt: new Date('2026-05-05T14:00:00'),
      location: 'قاعة VIP',
      createdById: users.techSec.id,
    },
  });

  // Meeting back to secretary after GS approval
  const mtgBackSec = await prisma.meeting.create({
    data: {
      refNumber: 'MTG-HIRING-2026-001',
      councilId: councils.HIRING.id,
      title: 'اجتماع مجلس التوظيف (بانتظار الرئيس)',
      status: 'MEETING_BACK_SEC',
      scheduledAt: new Date('2026-05-10T09:00:00'),
      location: 'قاعة الاجتماعات B',
      createdById: users.hireSec.id,
    },
  });

  // Meeting awaiting president approval
  const mtgPresApproval = await prisma.meeting.create({
    data: {
      refNumber: 'MTG-TECH-2026-003',
      councilId: councils.TECH.id,
      title: 'اجتماع مجلس التقنية الثالث (بانتظار رئيس المجلس)',
      status: 'MEETING_PRES_APPROVAL',
      scheduledAt: new Date('2026-05-15T10:00:00'),
      location: 'قاعة الاجتماعات الكبرى',
      createdById: users.techSec.id,
    },
  });

  // Scheduled meeting (ready to hold)
  const mtgScheduled = await prisma.meeting.create({
    data: {
      refNumber: 'MTG-TECH-2026-004',
      councilId: councils.TECH.id,
      title: 'اجتماع مجلس التقنية المجدول',
      status: 'MEETING_SCHEDULED',
      scheduledAt: new Date('2026-04-20T10:00:00'),
      location: 'قاعة المجلس',
      createdById: users.techSec.id,
    },
  });

  // Link the LINKED_TO_MEETING topic to the scheduled meeting
  await prisma.meetingTopicLink.create({
    data: {
      meetingId: mtgScheduled.id,
      topicId: linkedTopic.id,
      orderIndex: 0,
    },
  });

  // Held meeting (completed, ready for minutes)
  const mtgHeld = await prisma.meeting.create({
    data: {
      refNumber: 'MTG-TECH-2026-005',
      councilId: councils.TECH.id,
      title: 'اجتماع مجلس التقنية المنعقد',
      status: 'MEETING_HELD',
      scheduledAt: new Date('2026-03-15T10:00:00'),
      heldAt: new Date('2026-03-15T10:30:00'),
      location: 'قاعة المجلس',
      createdById: users.techSec.id,
    },
  });

  // Another held meeting for HIRING
  const mtgHeldHire = await prisma.meeting.create({
    data: {
      refNumber: 'MTG-HIRING-2026-002',
      councilId: councils.HIRING.id,
      title: 'اجتماع مجلس التوظيف المنعقد',
      status: 'MEETING_HELD',
      scheduledAt: new Date('2026-03-20T09:00:00'),
      heldAt: new Date('2026-03-20T09:15:00'),
      location: 'قاعة B',
      createdById: users.hireSec.id,
    },
  });

  // ══════════════════════════════════════════════════════
  // المحاضر — بحالات مختلفة
  // ══════════════════════════════════════════════════════

  // Minutes in DRAFT
  const minDraft = await prisma.minutes.create({
    data: {
      meetingId: mtgHeld.id,
      status: 'MIN_DRAFT',
      body: 'محضر اجتماع مجلس التقنية المنعقد بتاريخ 15/03/2026\n\nالحاضرون: ...\n\nجدول الأعمال:\n1. مناقشة مشروع البنية التحتية\n2. اعتماد ميزانية التطوير\n\nالقرارات: ...',
    },
  });

  // Minutes in GS_REVIEW
  const minGSReview = await prisma.minutes.create({
    data: {
      meetingId: mtgHeldHire.id,
      status: 'MIN_GS_REVIEW',
      body: 'محضر اجتماع مجلس التوظيف المنعقد بتاريخ 20/03/2026\n\nالحاضرون: ...\n\nجدول الأعمال:\n1. مراجعة خطة التوظيف\n2. اعتماد سياسة الاستقطاب\n\nالقرارات: ...',
    },
  });

  // Create a fully-signed minutes for decision creation
  const mtgForDecision = await prisma.meeting.create({
    data: {
      refNumber: 'MTG-TECH-2026-006',
      councilId: councils.TECH.id,
      title: 'اجتماع مجلس التقنية — محضر موقّع',
      status: 'MEETING_HELD',
      scheduledAt: new Date('2026-02-15T10:00:00'),
      heldAt: new Date('2026-02-15T10:30:00'),
      location: 'قاعة المجلس',
      createdById: users.techSec.id,
    },
  });

  const minSigned = await prisma.minutes.create({
    data: {
      meetingId: mtgForDecision.id,
      status: 'MIN_SIGNED',
      body: 'محضر موقّع — اجتماع فبراير\n\nتم مناقشة واعتماد المواضيع التالية...',
      signedAt: new Date('2026-02-20T14:00:00'),
      signedById: users.techPres.id,
    },
  });

  // Minutes awaiting member feedback
  const mtgForFeedback = await prisma.meeting.create({
    data: {
      refNumber: 'MTG-TECH-2026-007',
      councilId: councils.TECH.id,
      title: 'اجتماع مجلس التقنية — بانتظار مرئيات الأعضاء',
      status: 'MEETING_HELD',
      scheduledAt: new Date('2026-03-01T10:00:00'),
      heldAt: new Date('2026-03-01T10:15:00'),
      location: 'قاعة المجلس',
      createdById: users.techSec.id,
    },
  });

  const minConsult = await prisma.minutes.create({
    data: {
      meetingId: mtgForFeedback.id,
      status: 'MIN_MEMBERS_CONSULT',
      body: 'محضر بانتظار مرئيات الأعضاء\n\nيرجى من أعضاء المجلس إبداء مرئياتهم...',
      feedbackDeadline: new Date('2026-04-15T23:59:59'),
    },
  });

  // ══════════════════════════════════════════════════════
  // القرارات
  // ══════════════════════════════════════════════════════

  // Create a topic that reached DECISION_ISSUED
  const decisionTopic = await createTopicAtStatus(
    'قرار صادر: اعتماد سياسة الحوكمة الرقمية',
    'TECH', 'IT_DEPT', users.itStaff,
    'DECISION_ISSUED',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
      { status: 'GS_REVIEW', action: 'AUTO', actor: users.gs },
      { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
      { status: 'EXAM_IN_PROGRESS', action: 'ASSIGN_EXAM', actor: users.techSec },
      { status: 'EXAM_COMPLETE', action: 'EXAM_PASS', actor: users.techExam },
      { status: 'PRESIDENT_REVIEW', action: 'SUBMIT_TO_PRESIDENT', actor: users.techSec },
      { status: 'IN_AGENDA_BOX', action: 'MARK_SUITABLE', actor: users.techPres },
      { status: 'DISCUSSED', action: 'MARK_DISCUSSED', actor: users.techSec },
      { status: 'DECISION_ISSUED', action: 'ISSUE_DECISION', actor: users.techPres },
    ],
  );

  // Decision in DEC_DRAFT (can be issued by president)
  await prisma.decision.create({
    data: {
      refNumber: 'DEC-TECH-2026-001',
      topicId: decisionTopic.id,
      minutesId: minSigned.id,
      status: 'DEC_DRAFT',
      summary: 'اعتماد سياسة الحوكمة الرقمية الشاملة لجميع الأنظمة',
    },
  });

  // Issued decision
  const decisionTopic2 = await createTopicAtStatus(
    'قرار صادر: ميزانية الأمن السيبراني',
    'TECH', 'IT_DEPT', users.itStaff,
    'DECISION_ISSUED',
    [
      { status: 'PENDING_DEPT_MGR', action: 'SUBMIT_TO_MANAGER', actor: users.itStaff },
      { status: 'APPROVED', action: 'APPROVE', actor: users.itManager },
      { status: 'INBOX_GS', action: 'SEND_TO_GS', actor: users.itManager },
      { status: 'WITH_COUNCIL', action: 'ACCEPT', actor: users.gs },
      { status: 'EXAM_COMPLETE', action: 'EXAM_PASS', actor: users.techExam },
      { status: 'IN_AGENDA_BOX', action: 'MARK_SUITABLE', actor: users.techPres },
      { status: 'DECISION_ISSUED', action: 'ISSUE_DECISION', actor: users.techPres },
    ],
  );

  await prisma.decision.create({
    data: {
      refNumber: 'DEC-TECH-2026-002',
      topicId: decisionTopic2.id,
      minutesId: minSigned.id,
      status: 'DEC_ISSUED',
      summary: 'تخصيص ميزانية 5 مليون ريال للأمن السيبراني',
      issuedAt: new Date('2026-02-25T10:00:00'),
      issuedById: users.techPres.id,
    },
  });

  // ══════════════════════════════════════════════════════
  // الإشعارات
  // ══════════════════════════════════════════════════════
  const notifRecipients = [users.itManager, users.hrManager, users.finManager, users.techSec, users.gs];
  for (let i = 0; i < notifRecipients.length; i++) {
    await prisma.notification.create({
      data: {
        type: 'WORKFLOW_ALERT',
        status: 'NOTIF_PENDING',
        recipientId: notifRecipients[i].id,
        title: `إشعار اختبار ${i + 1}`,
        body: 'هذا إشعار تجريبي لاختبار النظام',
      },
    });
  }

  // ══════════════════════════════════════════════════════
  // التفويضات
  // ══════════════════════════════════════════════════════
  await prisma.delegation.create({
    data: {
      state: 'DELEGATION_ACTIVE',
      fromUserId: users.gs.id,
      toUserId: users.gsStaff.id,
      scopeType: 'FULL_ROLE',
      scopeJson: JSON.stringify({ roleCode: 'GENERAL_SECRETARY' }),
      validFrom: new Date('2026-04-01'),
      validUntil: new Date('2026-06-30'),
      reason: 'تفويض مؤقت أثناء إجازة الأمين العام',
    },
  });

  await prisma.delegation.create({
    data: {
      state: 'DELEGATION_DRAFT',
      fromUserId: users.techPres.id,
      toUserId: users.techMember1.id,
      scopeType: 'FULL_ROLE',
      scopeJson: JSON.stringify({ roleCode: 'COUNCIL_PRESIDENT' }),
      validFrom: new Date('2026-05-01'),
      validUntil: new Date('2026-05-15'),
      reason: 'تفويض مؤقت لرئاسة المجلس',
    },
  });

  // ══════════════════════════════════════════════════════
  // سجلات التدقيق
  // ══════════════════════════════════════════════════════
  const auditActions = ['CREATE_TOPIC', 'APPROVE_TOPIC', 'TRANSITION', 'LOGIN', 'CREATE_MEETING'];
  for (let i = 0; i < 15; i++) {
    await prisma.auditLog.create({
      data: {
        entityType: 'Topic',
        entityId: allTopics[i % allTopics.length]?.id || 'system',
        action: auditActions[i % auditActions.length],
        actorActualId: users.admin.id,
        actorDisplayId: users.admin.id,
        reason: 'إجراء نظامي',
      },
    });
  }

  // ══════════════════════════════════════════════════════
  // إعدادات النظام
  // ══════════════════════════════════════════════════════
  const configs = [
    { key: 'MAX_AGENDA_ITEMS', value: '15', valueType: 'INT', description: 'الحد الأقصى لبنود الأجندة' },
    { key: 'FEEDBACK_DEADLINE_DAYS', value: '7', valueType: 'INT', description: 'مهلة المرئيات بالأيام' },
    { key: 'EXAM_RETRY_LIMIT', value: '3', valueType: 'INT', description: 'الحد الأقصى لإعادة الفحص' },
    { key: 'NOTIFICATION_RETRY_MAX', value: '5', valueType: 'INT', description: 'عدد محاولات التبليغ' },
  ];
  for (const c of configs) {
    await prisma.systemConfig.create({ data: c });
  }

  // ══════════════════════════════════════════════════════
  // ملخص
  // ══════════════════════════════════════════════════════
  const counts = {
    topics: await prisma.topic.count(),
    statusLogs: await prisma.topicStatusLog.count(),
    examinations: await prisma.examination.count(),
    meetings: await prisma.meeting.count(),
    minutes: await prisma.minutes.count(),
    decisions: await prisma.decision.count(),
    notifications: await prisma.notification.count(),
    delegations: await prisma.delegation.count(),
    auditLogs: await prisma.auditLog.count(),
    users: await prisma.user.count(),
  };

  console.log(`
══════════════════════════════════════════════════

  📊 ملخص البيانات:
  ─────────────────────
  المستخدمون:          ${counts.users}
  المواضيع:            ${counts.topics}
  سجلات الحالات:       ${counts.statusLogs}
  الفحوصات:            ${counts.examinations}
  الاجتماعات:          ${counts.meetings}
  المحاضر:             ${counts.minutes}
  القرارات:            ${counts.decisions}
  الإشعارات:           ${counts.notifications}
  التفويضات:           ${counts.delegations}
  سجلات التدقيق:       ${counts.auditLogs}

  ════════════════════════════════════════════
  دليل الاختبار — سجّل دخول واختبر الإجراء:
  ════════════════════════════════════════════

  1. DEPT_STAFF (it.staff@company.sa)
     → افتح موضوع "مسودة" → اضغط "إرسال للمدير"

  2. DEPT_MANAGER (it.manager@company.sa)
     → "بانتظار الاعتماد" → اعتماد أو إعادة
     → "معتمد" → إرسال للأمين أو سحب الاعتماد
     → "مُعاد" → إعادة الإرسال أو إغلاق

  3. GENERAL_SECRETARY (gs@company.sa)
     → "مراجعة الأمين" → قبول / تعليق / رفض / إعادة
     → "معلّق" → استئناف

  4. COUNCIL_SECRETARY (tech.sec@company.sa)
     → "لدى المجلس" → إحالة للفحص
     → "فحص غير مكتمل" → إعادة الفحص
     → "فحص مكتمل" → رفع لرئيس المجلس
     → "مُعاد للمجلس" → إعادة فحص أو رفع للرئيس

  5. EXAM_OFFICER (tech.exam@company.sa)
     → "قيد الفحص" → فحص مكتمل / غير مكتمل

  6. COUNCIL_PRESIDENT (tech.pres@company.sa)
     → "مراجعة الرئيس" → مناسب للإدراج / إعادة
     → "مرتبط باجتماع" → تأجيل في الجلسة

  7. COUNCIL_MEMBER (tech.m1@company.sa)
     → محضر بانتظار المرئيات → إضافة مرئية

  8. GS_OFFICE_STAFF (gs.staff@company.sa)
     → نفس صلاحيات الأمين (عبر التفويض)

  9. SYSTEM_ADMIN (admin@company.sa)
     → صفحات الإدارة: المستخدمون / المجالس / الإعدادات

  كلمة المرور لجميع الحسابات: Admin@123
`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
