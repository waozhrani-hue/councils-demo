# خطة إعادة هيكلة النظام - نظام مرن 100%

## الهدف
تحويل النظام من أدوار وصلاحيات ومسارات عمل **صلبة في الكود** إلى نظام **ديناميكي بالكامل** يُدار من قاعدة البيانات ولوحة التحكم.

---

## المبادئ الأساسية
1. **صفر كود صلب** — لا أدوار، لا صلاحيات، لا مسارات عمل مكتوبة في الكود
2. **كل شيء من قاعدة البيانات** — الكود يقرأ ويُنفذ فقط
3. **هيكل تنظيمي شجري** — N مستويات ديناميكية لكل إدارة
4. **سلسلة اعتماد هرمية** — الموضوع يصعد من مستوى لمستوى تلقائياً
5. **محرك workflow عام** — يخدم المواضيع والاجتماعات والمحاضر وأي كيان مستقبلي

---

## المرحلة 1: تعديل Schema (قاعدة البيانات)

### 1.1 تعديل جدول OrganizationUnit
```prisma
model OrganizationUnit {
  id                  String   @id @default(cuid())
  name                String
  code                String   @unique        // رمز الوحدة (IT_DEPT, HR_SEC, etc.)
  parentId            String?                 // الوحدة الأب
  parent              OrganizationUnit? @relation("OrgHierarchy", fields: [parentId], references: [id])
  children            OrganizationUnit[] @relation("OrgHierarchy")
  level               Int      @default(0)    // العمق في الشجرة (يُحسب تلقائياً)
  unitType            String   @default("UNIT") // ORGANIZATION, AGENCY, DEPARTMENT, DIVISION, SECTION
  isApprovalAuthority Boolean  @default(false) // هل هذا المستوى هو نقطة الاعتماد النهائي؟
  managerId           String?                 // مسؤول هذه الوحدة (المعتمِد)
  manager             User?    @relation("OrgManager", fields: [managerId], references: [id])
  isActive            Boolean  @default(true)
  sortOrder           Int      @default(0)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### 1.2 جدول Permission (الصلاحيات)
```prisma
model Permission {
  id          String   @id @default(cuid())
  code        String   @unique   // SUBMIT_TOPIC, APPROVE_TOPIC, CREATE_MEETING, etc.
  nameAr      String             // الاسم بالعربي
  nameEn      String             // الاسم بالإنجليزي
  module      String             // TOPIC, MEETING, MINUTES, DECISION, ADMIN, DELEGATION
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  roles       RolePermission[]
}
```

### 1.3 تعديل جدول Role (ديناميكي)
```prisma
model Role {
  id          String   @id @default(cuid())
  code        String   @unique
  nameAr      String
  nameEn      String
  description String?
  isSystem    Boolean  @default(false)  // أدوار النظام الأساسية (لا تُحذف)
  scope       String   @default("GLOBAL") // GLOBAL, COUNCIL, ORG_UNIT
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  permissions RolePermission[]
  userRoles   UserRole[]
}
```

### 1.4 جدول RolePermission (ربط دور ↔ صلاحية)
```prisma
model RolePermission {
  id           String     @id @default(cuid())
  roleId       String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([roleId, permissionId])
}
```

### 1.5 جداول محرك Workflow
```prisma
// تعريف مسار العمل (مواضيع، اجتماعات، محاضر، قرارات)
model WorkflowDefinition {
  id          String   @id @default(cuid())
  code        String   @unique   // TOPIC_WORKFLOW, MEETING_WORKFLOW, MINUTES_WORKFLOW
  nameAr      String
  nameEn      String
  entityType  String             // Topic, Meeting, Minutes, Decision
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  states      WorkflowState[]
  transitions WorkflowTransition[]
}

// حالات مسار العمل
model WorkflowState {
  id           String   @id @default(cuid())
  workflowId   String
  workflow     WorkflowDefinition @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  code         String             // DRAFT, PENDING_APPROVAL, APPROVED, WITH_COUNCIL, etc.
  nameAr       String             // مسودة، قيد الاعتماد، معتمد، لدى المجلس
  nameEn       String
  stateType    String   @default("NORMAL") // INITIAL, NORMAL, APPROVAL, FINAL, CANCELLED
  color        String?            // لون البادج في الواجهة
  sortOrder    Int      @default(0)
  isActive     Boolean  @default(true)

  fromTransitions WorkflowTransition[] @relation("FromState")
  toTransitions   WorkflowTransition[] @relation("ToState")

  @@unique([workflowId, code])
}

// التحولات المسموحة بين الحالات
model WorkflowTransition {
  id              String   @id @default(cuid())
  workflowId      String
  workflow        WorkflowDefinition @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  fromStateId     String
  fromState       WorkflowState @relation("FromState", fields: [fromStateId], references: [id])
  toStateId       String
  toState         WorkflowState @relation("ToState", fields: [toStateId], references: [id])
  actionCode      String         // SUBMIT, APPROVE, REJECT, RETURN, ACCEPT, etc.
  actionNameAr    String         // إرسال، اعتماد، رفض، إعادة
  actionNameEn    String
  permissionCode  String         // الصلاحية المطلوبة: APPROVE_TOPIC, ACCEPT_TOPIC, etc.
  requiresReason  Boolean @default(false)  // هل يحتاج سبب؟
  requiresComment Boolean @default(false)
  isHierarchical  Boolean @default(false)  // هل ينتقل للمستوى الأعلى في الهيكل؟
  autoTransition  Boolean @default(false)  // تحول تلقائي (بدون تدخل مستخدم)
  buttonColor     String?        // primary, danger, default
  buttonIcon      String?        // اسم الأيقونة
  sortOrder       Int     @default(0)
  isActive        Boolean @default(true)

  @@unique([workflowId, fromStateId, actionCode])
}
```

### 1.6 جدول سلسلة اعتماد الموضوع
```prisma
// سلسلة الاعتماد الهرمي لكل موضوع (تُنشأ عند إرسال الموضوع)
model TopicApprovalStep {
  id          String   @id @default(cuid())
  topicId     String
  topic       Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)
  orgUnitId   String
  orgUnit     OrganizationUnit @relation(fields: [orgUnitId], references: [id])
  stepOrder   Int              // ترتيب الخطوة (1, 2, 3, ...)
  approverId  String?          // المعتمِد (مسؤول الوحدة وقت الإنشاء)
  approver    User?   @relation("StepApprover", fields: [approverId], references: [id])
  status      String  @default("PENDING") // PENDING, APPROVED, REJECTED, RETURNED, SKIPPED
  decidedAt   DateTime?
  reason      String?
  createdAt   DateTime @default(now())

  @@unique([topicId, stepOrder])
}
```

### 1.7 تعديل جدول Topic
```prisma
model Topic {
  // ... الحقول الحالية ...
  currentApprovalStepOrder  Int?     // الخطوة الحالية في سلسلة الاعتماد
  workflowId                String?  // مسار العمل المستخدم
  approvalSteps             TopicApprovalStep[]
}
```

---

## المرحلة 2: محرك Workflow الديناميكي (Backend)

### 2.1 WorkflowEngineService
```
ملف: backend/src/workflow/workflow-engine.service.ts

المسؤوليات:
- getAvailableTransitions(entityType, currentStatus, userPermissions, context)
  → يرجع قائمة الإجراءات المتاحة للمستخدم
  
- executeTransition(entityType, entityId, actionCode, userId, payload)
  → يتحقق من الصلاحية
  → يتحقق من التحول صالح
  → ينفذ التحول
  → يسجل في StatusLog
  → يرسل إشعارات
  
- getStateInfo(workflowCode, stateCode)
  → يرجع معلومات الحالة (اسم عربي، لون، نوع)
```

### 2.2 HierarchicalApprovalService
```
ملف: backend/src/workflow/hierarchical-approval.service.ts

المسؤوليات:
- buildApprovalChain(userId, orgUnitId)
  → يحسب سلسلة الاعتماد من وحدة المستخدم لأعلى حتى isApprovalAuthority
  → يرجع [{orgUnitId, managerId, stepOrder}]

- submitToNextLevel(topicId)
  → ينقل الموضوع للمستوى الأعلى في السلسلة
  
- approveAtCurrentLevel(topicId, approverId, reason?)
  → يعتمد في المستوى الحالي
  → إذا آخر مستوى → ينقل لحالة "معتمد" ثم يُرسل للأمانة
  → إذا مو آخر مستوى → ينقل للمستوى التالي
  
- rejectAtCurrentLevel(topicId, approverId, reason)
  → يرفض → يعود للمنشئ
  
- returnToPreviousLevel(topicId, approverId, reason)
  → يعيد للمستوى السابق
```

### 2.3 DynamicPermissionService
```
ملف: backend/src/auth/dynamic-permission.service.ts

المسؤوليات:
- getUserPermissions(userId)
  → يجمع كل صلاحيات المستخدم من أدواره + التفويضات النشطة
  
- hasPermission(userId, permissionCode, context?)
  → يتحقق هل المستخدم يملك الصلاحية
  → context يشمل: councilId, orgUnitId (للصلاحيات المقيدة بنطاق)
  
- getPermissionsForScope(userId, scope)
  → صلاحيات المستخدم في نطاق معين (مجلس معين، وحدة معينة)
```

---

## المرحلة 3: Dynamic Permission Guard (Backend)

### 3.1 استبدال @Roles بـ @RequirePermission
```typescript
// قديم (صلب):
@Roles('DEPT_MANAGER')
@Get()
findAll() {}

// جديد (مرن):
@RequirePermission('VIEW_TOPICS')
@Get()
findAll() {}
```

### 3.2 PermissionGuard
```
ملف: backend/src/auth/guards/permission.guard.ts

- يقرأ @RequirePermission من الـ handler
- يستدعي DynamicPermissionService.hasPermission()
- يدعم التفويضات النشطة تلقائياً
- يدعم النطاقات (council, orgUnit)
```

---

## المرحلة 4: تعديل Controllers & Services

### 4.1 TopicsController
```
- POST /topics → @RequirePermission('CREATE_TOPIC')
- GET /topics → @RequirePermission('VIEW_TOPICS')
- POST /topics/:id/transition → يتحقق من الصلاحية ديناميكياً عبر WorkflowEngine
- GET /topics/:id/available-actions → يرجع الإجراءات المتاحة للمستخدم الحالي
```

### 4.2 MeetingsController (نفس النمط)
### 4.3 MinutesController (نفس النمط)
### 4.4 DecisionsController (نفس النمط)

### 4.5 API جديد: Workflow API
```
GET  /api/v1/workflow/definitions          → قائمة مسارات العمل
GET  /api/v1/workflow/:code/states         → حالات مسار معين
GET  /api/v1/workflow/:code/transitions    → تحولات مسار معين
POST /api/v1/workflow/transition           → تنفيذ تحول (عام)
GET  /api/v1/workflow/available-actions/:entityType/:entityId → الإجراءات المتاحة
```

### 4.6 API جديد: Org Hierarchy API
```
GET    /api/v1/org-units/tree              → الهيكل كشجرة كاملة
POST   /api/v1/org-units                   → إضافة وحدة
PATCH  /api/v1/org-units/:id               → تعديل وحدة
DELETE /api/v1/org-units/:id               → حذف وحدة (إذا فارغة)
PATCH  /api/v1/org-units/:id/manager       → تعيين مسؤول
GET    /api/v1/org-units/:id/approval-chain → عرض سلسلة الاعتماد
```

### 4.7 API جديد: Permissions API
```
GET  /api/v1/permissions                   → كل الصلاحيات
GET  /api/v1/roles                         → كل الأدوار
POST /api/v1/roles                         → إنشاء دور جديد
PATCH /api/v1/roles/:id                    → تعديل دور
POST /api/v1/roles/:id/permissions         → إضافة صلاحيات لدور
DELETE /api/v1/roles/:id/permissions/:pid   → حذف صلاحية من دور
GET  /api/v1/users/:id/permissions         → صلاحيات مستخدم (مجمعة)
```

---

## المرحلة 5: Frontend - إدارة الهيكل التنظيمي

### 5.1 صفحة الهيكل التنظيمي (Admin)
```
صفحة: /admin/org-structure

- عرض شجري (Ant Design Tree component)
- إضافة/تعديل/حذف وحدات
- سحب وإفلات لتغيير المستويات
- تعيين مسؤول لكل وحدة
- تحديد نقطة الاعتماد النهائي (isApprovalAuthority)
- عرض سلسلة الاعتماد المحسوبة لكل وحدة
```

### 5.2 صفحة الأدوار والصلاحيات (Admin)
```
صفحة: /admin/roles-permissions

- قائمة الأدوار مع إمكانية الإضافة والتعديل
- لكل دور: checkbox list بالصلاحيات المتاحة
- تجميع الصلاحيات حسب الوحدة (Module): مواضيع، اجتماعات، محاضر، إدارة
- معاينة: "المستخدمون بهذا الدور" 
```

---

## المرحلة 6: Frontend - واجهات ديناميكية

### 6.1 القائمة الجانبية الديناميكية
```
بدل:
  if (hasRole('DEPT_MANAGER')) showMenu('topics')

الجديد:
  GET /api/v1/users/me/menu-items
  → يرجع قائمة الصفحات المتاحة بناءً على صلاحيات المستخدم
  → الفرونت يعرض القائمة كما هي بدون شروط
```

### 6.2 أزرار الإجراءات الديناميكية
```
بدل:
  if (status === 'PENDING_DEPT_MGR' && hasRole('DEPT_MANAGER'))
    showButton('اعتماد')

الجديد:
  GET /api/v1/workflow/available-actions/topic/:id
  → يرجع [{actionCode, nameAr, buttonColor, buttonIcon, requiresReason}]
  → الفرونت يعرض الأزرار كما هي
```

### 6.3 StatusBadge ديناميكي
```
بدل:
  const statusLabelMap = { 'DRAFT': 'مسودة', ... } // في الكود

الجديد:
  GET /api/v1/workflow/states/:workflowCode
  → يرجع [{code, nameAr, color}]
  → StatusBadge يقرأ من cache/context
```

---

## المرحلة 7: Seed Data

### 7.1 الصلاحيات الافتراضية
```
Module: TOPIC
  - CREATE_TOPIC          (إنشاء موضوع)
  - VIEW_TOPICS           (عرض المواضيع)
  - VIEW_ALL_TOPICS       (عرض جميع المواضيع)
  - EDIT_OWN_TOPIC        (تعديل موضوعي)
  - SUBMIT_TOPIC          (إرسال موضوع)
  - APPROVE_TOPIC         (اعتماد في المستوى الهرمي)
  - REJECT_TOPIC          (رفض موضوع)
  - RETURN_TOPIC          (إعادة موضوع)
  - ACCEPT_GS             (قبول الأمين العام)
  - REJECT_GS             (رفض الأمين العام)
  - RETURN_GS             (إعادة الأمين العام)

Module: EXAMINATION
  - ASSIGN_EXAM           (إحالة للفحص)
  - PERFORM_EXAM          (تنفيذ الفحص)
  - SUBMIT_TO_PRESIDENT   (رفع لرئيس المجلس)

Module: COUNCIL
  - REVIEW_AS_PRESIDENT   (مراجعة كرئيس مجلس)
  - MANAGE_AGENDA         (إدارة صندوق الأجندة)
  - LINK_TO_MEETING       (ربط باجتماع)

Module: MEETING
  - CREATE_MEETING        (إنشاء اجتماع)
  - VIEW_MEETINGS         (عرض الاجتماعات)
  - APPROVE_MEETING_GS    (اعتماد اجتماع - أمين عام)
  - APPROVE_MEETING_PRES  (اعتماد اجتماع - رئيس)
  - HOLD_MEETING          (عقد اجتماع)
  - CANCEL_MEETING        (إلغاء اجتماع)

Module: MINUTES
  - CREATE_MINUTES        (إنشاء محضر)
  - VIEW_MINUTES          (عرض المحاضر)
  - REVIEW_MINUTES_GS     (مراجعة محضر - أمين عام)
  - SIGN_MINUTES          (توقيع محضر)
  - PROVIDE_FEEDBACK      (تقديم ملاحظات على المحضر)

Module: DECISION
  - VIEW_DECISIONS        (عرض القرارات)
  - ISSUE_DECISION        (إصدار قرار)

Module: ADMIN
  - MANAGE_USERS          (إدارة المستخدمين)
  - MANAGE_ROLES          (إدارة الأدوار)
  - MANAGE_ORG_STRUCTURE  (إدارة الهيكل التنظيمي)
  - MANAGE_WORKFLOWS      (إدارة مسارات العمل)
  - MANAGE_COUNCILS       (إدارة المجالس)
  - MANAGE_CONFIG         (إدارة التهيئة)
  - VIEW_AUDIT            (عرض التدقيق)

Module: DELEGATION
  - CREATE_DELEGATION     (إنشاء تفويض)
  - MANAGE_TEAM           (إدارة الفريق)

Module: NOTIFICATION
  - VIEW_NOTIFICATIONS    (عرض الإشعارات)
```

### 7.2 الأدوار الافتراضية وصلاحياتها
```
SYSTEM_ADMIN (مدير النظام):
  → جميع صلاحيات ADMIN + VIEW_ALL_TOPICS + VIEW_AUDIT

EMPLOYEE (موظف):
  → CREATE_TOPIC, VIEW_TOPICS, EDIT_OWN_TOPIC, SUBMIT_TOPIC, VIEW_DECISIONS, VIEW_NOTIFICATIONS

ORG_MANAGER (مسؤول وحدة تنظيمية):
  → كل صلاحيات EMPLOYEE + APPROVE_TOPIC, REJECT_TOPIC, RETURN_TOPIC, MANAGE_TEAM

GENERAL_SECRETARY (الأمين العام):
  → VIEW_ALL_TOPICS, ACCEPT_GS, REJECT_GS, RETURN_GS
  → APPROVE_MEETING_GS, REVIEW_MINUTES_GS
  → CREATE_DELEGATION, MANAGE_TEAM

GS_OFFICE_STAFF (موظف مكتب الأمين):
  → VIEW_ALL_TOPICS, VIEW_MEETINGS, VIEW_MINUTES (قابل للتفويض من الأمين)

COUNCIL_SECRETARY (أمين المجلس):
  → ASSIGN_EXAM, SUBMIT_TO_PRESIDENT, MANAGE_AGENDA, LINK_TO_MEETING
  → CREATE_MEETING, HOLD_MEETING, CANCEL_MEETING
  → CREATE_MINUTES, VIEW_MINUTES
  → MANAGE_TEAM, CREATE_DELEGATION

COUNCIL_PRESIDENT (رئيس المجلس):
  → REVIEW_AS_PRESIDENT, APPROVE_MEETING_PRES, SIGN_MINUTES, ISSUE_DECISION

COUNCIL_MEMBER (عضو مجلس):
  → VIEW_MEETINGS, VIEW_MINUTES, PROVIDE_FEEDBACK, VIEW_DECISIONS

EXAM_OFFICER (مسؤول فحص):
  → PERFORM_EXAM

COUNCIL_STAFF (موظف مجلس):
  → VIEW_MEETINGS, VIEW_DECISIONS
```

### 7.3 مسار عمل المواضيع (Workflow: TOPIC_WORKFLOW)
```
الحالات:
  DRAFT              → مسودة                    (INITIAL, gray)
  PENDING_APPROVAL   → قيد الاعتماد الهرمي       (APPROVAL, blue)
  HIERARCHY_APPROVED → معتمد من الإدارة           (NORMAL, green)
  SENT_TO_GS         → مُرسل للأمانة              (NORMAL, blue)
  INBOX_GS           → وارد الأمانة               (NORMAL, orange)
  GS_REVIEW          → قيد مراجعة الأمين           (NORMAL, orange)
  RETURNED_DEPT      → مُعاد للإدارة              (NORMAL, red)
  CLOSED_BY_DEPT     → مغلق من الإدارة            (FINAL, gray)
  WITH_COUNCIL       → لدى المجلس                 (NORMAL, purple)
  EXAM_IN_PROGRESS   → قيد الفحص                  (NORMAL, blue)
  EXAM_COMPLETE      → فحص مكتمل                  (NORMAL, green)
  EXAM_INCOMPLETE    → فحص غير مكتمل              (NORMAL, red)
  PRESIDENT_REVIEW   → مراجعة الرئيس              (NORMAL, orange)
  RETURNED_COUNCIL   → مُعاد من الرئيس            (NORMAL, red)
  IN_AGENDA_BOX      → في صندوق الأجندة           (NORMAL, cyan)
  LINKED_TO_MEETING  → مرتبط باجتماع              (NORMAL, blue)
  DEFERRED_IN_SESSION → مؤجل في الجلسة            (NORMAL, orange)
  DISCUSSED          → نوقش                       (NORMAL, green)
  DECISION_ISSUED    → صدر فيه قرار               (FINAL, green)

التحولات:
  DRAFT → PENDING_APPROVAL
    action: SUBMIT | nameAr: إرسال | permission: SUBMIT_TOPIC | isHierarchical: true

  PENDING_APPROVAL → PENDING_APPROVAL (المستوى التالي)
    action: APPROVE_LEVEL | nameAr: اعتماد | permission: APPROVE_TOPIC | isHierarchical: true

  PENDING_APPROVAL → DRAFT
    action: REJECT_LEVEL | nameAr: رفض | permission: REJECT_TOPIC | requiresReason: true

  PENDING_APPROVAL → PENDING_APPROVAL (المستوى السابق)
    action: RETURN_LEVEL | nameAr: إعادة | permission: RETURN_TOPIC | requiresReason: true

  HIERARCHY_APPROVED → SENT_TO_GS
    action: SEND_TO_GS | nameAr: إرسال للأمانة | permission: APPROVE_TOPIC | autoTransition: true

  SENT_TO_GS → INBOX_GS
    action: AUTO_RECEIVE | autoTransition: true

  INBOX_GS → GS_REVIEW
    action: AUTO_REVIEW | autoTransition: true

  GS_REVIEW → WITH_COUNCIL
    action: ACCEPT | nameAr: قبول وتحويل | permission: ACCEPT_GS | buttonColor: primary

  GS_REVIEW → RETURNED_DEPT
    action: RETURN_WRONG_COUNCIL | nameAr: إعادة | permission: RETURN_GS | requiresReason: true

  GS_REVIEW → RETURNED_DEPT
    action: REJECT | nameAr: رفض | permission: REJECT_GS | requiresReason: true | buttonColor: danger

  RETURNED_DEPT → SENT_TO_GS
    action: RESUBMIT | nameAr: إعادة الإرسال | permission: APPROVE_TOPIC

  RETURNED_DEPT → CLOSED_BY_DEPT
    action: CLOSE_BY_DEPT | nameAr: إغلاق | permission: APPROVE_TOPIC | buttonColor: danger

  WITH_COUNCIL → EXAM_IN_PROGRESS
    action: ASSIGN_EXAM | nameAr: إحالة للفحص | permission: ASSIGN_EXAM

  EXAM_IN_PROGRESS → EXAM_COMPLETE
    action: EXAM_PASS | nameAr: فحص مكتمل | permission: PERFORM_EXAM

  EXAM_IN_PROGRESS → EXAM_INCOMPLETE
    action: EXAM_FAIL | nameAr: فحص غير مكتمل | permission: PERFORM_EXAM | requiresReason: true

  EXAM_INCOMPLETE → EXAM_IN_PROGRESS
    action: REEXAM | nameAr: إعادة الفحص | permission: ASSIGN_EXAM

  EXAM_COMPLETE → PRESIDENT_REVIEW
    action: SUBMIT_TO_PRESIDENT | nameAr: رفع للرئيس | permission: SUBMIT_TO_PRESIDENT

  PRESIDENT_REVIEW → IN_AGENDA_BOX
    action: MARK_SUITABLE | nameAr: مناسب للإدراج | permission: REVIEW_AS_PRESIDENT

  PRESIDENT_REVIEW → RETURNED_COUNCIL
    action: RETURN_TO_COUNCIL | nameAr: إعادة للمجلس | permission: REVIEW_AS_PRESIDENT | requiresReason: true

  RETURNED_COUNCIL → EXAM_IN_PROGRESS
    action: REEXAM | nameAr: إعادة الفحص | permission: ASSIGN_EXAM

  RETURNED_COUNCIL → PRESIDENT_REVIEW
    action: SUBMIT_TO_PRESIDENT | nameAr: إعادة الرفع | permission: SUBMIT_TO_PRESIDENT

  IN_AGENDA_BOX → LINKED_TO_MEETING
    action: LINK_TO_MEETING | nameAr: ربط باجتماع | permission: LINK_TO_MEETING

  LINKED_TO_MEETING → IN_AGENDA_BOX
    action: WITHDRAW | nameAr: سحب من الاجتماع | permission: LINK_TO_MEETING

  LINKED_TO_MEETING → DEFERRED_IN_SESSION
    action: DEFER | nameAr: تأجيل | permission: REVIEW_AS_PRESIDENT

  DEFERRED_IN_SESSION → IN_AGENDA_BOX
    action: AUTO_RETURN | autoTransition: true

  LINKED_TO_MEETING → DISCUSSED
    action: MARK_DISCUSSED | nameAr: تم النقاش | permission: HOLD_MEETING
```

### 7.4 هيكل تنظيمي تجريبي
```
المنظمة (level 0)
├── وكالة التقنية (level 1, isApprovalAuthority ✅, manager: وكيل التقنية)
│   ├── إدارة البنية التحتية (level 2, manager: مدير البنية التحتية)
│   │   ├── قسم الشبكات (level 3, manager: رئيس قسم الشبكات)
│   │   └── قسم السيرفرات (level 3, manager: رئيس قسم السيرفرات)
│   └── إدارة التطوير (level 2, manager: مدير التطوير)
│       └── قسم البرمجة (level 3, manager: رئيس قسم البرمجة)
├── وكالة الموارد البشرية (level 1, isApprovalAuthority ✅, manager: وكيل الموارد)
│   └── إدارة التوظيف (level 2, manager: مدير التوظيف)
└── مكتب الأمين العام (level 1)
```

---

## المرحلة 8: Frontend - القائمة والأزرار الديناميكية

### 8.1 MenuConfigProvider
```
- GET /api/v1/users/me/permissions → cache في context
- القائمة الجانبية تُبنى من config ثابت لكن يُفلتر حسب الصلاحيات:
  menuItems.filter(item => userPermissions.includes(item.requiredPermission))
```

### 8.2 DynamicActionButtons component
```
- يستدعي GET /api/v1/workflow/available-actions/:entityType/:entityId
- يعرض أزرار بناءً على الاستجابة
- كل زر: {nameAr, actionCode, buttonColor, buttonIcon, requiresReason}
- عند الضغط: POST /api/v1/workflow/transition
```

---

## ملاحظات التنفيذ
1. الـ Seed يملأ جميع الجداول الجديدة ببيانات تجريبية متنوعة
2. نحتفظ بالجداول القديمة مؤقتاً ونعمل migration تدريجي
3. الـ Workflow Engine عام — يخدم أي entity مستقبلي
4. كل API يرجع بيانات كافية للفرونت بدون hardcoding
5. التحقق دائماً من DB وليس من الكود

---

## ترتيب ملفات جديدة
```
backend/src/
├── workflow/
│   ├── workflow.module.ts
│   ├── workflow.controller.ts
│   ├── workflow-engine.service.ts
│   └── hierarchical-approval.service.ts
├── auth/
│   ├── guards/permission.guard.ts        (جديد)
│   ├── decorators/require-permission.ts  (جديد)
│   └── dynamic-permission.service.ts     (جديد)
├── org-units/
│   ├── org-units.module.ts               (معدّل)
│   ├── org-units.controller.ts           (معدّل)
│   └── org-units.service.ts              (معدّل)
└── permissions/
    ├── permissions.module.ts
    ├── permissions.controller.ts
    └── permissions.service.ts

frontend/src/
├── pages/admin/
│   ├── AdminOrgStructurePage.tsx          (جديد - شجرة الهيكل)
│   └── AdminRolesPermissionsPage.tsx      (جديد - أدوار وصلاحيات)
├── components/
│   ├── DynamicActionButtons.tsx           (جديد)
│   └── StatusBadge.tsx                    (معدّل - يقرأ من context)
├── hooks/
│   └── usePermissions.ts                 (جديد)
└── contexts/
    └── PermissionsContext.tsx             (جديد)
```
