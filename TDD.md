# وثيقة التصميم الفني (TDD)
## نظام إدارة المجالس — الإصدار الأول (MVP)

| الحقل | القيمة |
|--------|--------|
| الإصدار | 1.0 |
| تاريخ الإنشاء | 2026-04-10 |
| الحالة | مسودة للمراجعة |
| المرجع | PRD v1.0 (2026-04-07) |
| اللغة | عربي — واجهة RTL |

---

## الفهرس

1. [نظرة عامة على البنية المعمارية](#1-نظرة-عامة-على-البنية-المعمارية)
2. [المكدس التقني](#2-المكدس-التقني)
3. [نموذج البيانات التفصيلي](#3-نموذج-البيانات-التفصيلي)
4. [آلة الحالات — انتقالات الكيانات](#4-آلة-الحالات--انتقالات-الكيانات)
5. [تصميم واجهة برمجة التطبيقات — رفع الموضوع](#5-تصميم-واجهة-برمجة-التطبيقات--رفع-الموضوع)
6. [تصميم API — استقبال الموضوع والفحص](#6-تصميم-api--استقبال-الموضوع-والفحص)
7. [تصميم API — الاجتماعات وصندوق الأجندة](#7-تصميم-api--الاجتماعات-وصندوق-الأجندة)
8. [تصميم API — المحضر والقرار والتبليغ](#8-تصميم-api--المحضر-والقرار-والتبليغ)
9. [المصادقة والتفويض](#9-المصادقة-والتفويض)
10. [الأمان والسرية](#10-الأمان-والسرية)
11. [وصف الشاشات وتدفق الواجهة](#11-وصف-الشاشات-وتدفق-الواجهة)
12. [الإشعارات والتنبيهات](#12-الإشعارات-والتنبيهات)
13. [لوحة المعلومات والتقارير](#13-لوحة-المعلومات-والتقارير)
14. [معلمات التهيئة](#14-معلمات-التهيئة)
15. [خطة الاختبار ومعايير القبول](#15-خطة-الاختبار-ومعايير-القبول)
16. [النشر والبنية التحتية](#16-النشر-والبنية-التحتية)
17. [سيناريوهات حافة ومعالجة الأخطاء](#17-سيناريوهات-حافة-ومعالجة-الأخطاء)

---

## 1. نظرة عامة على البنية المعمارية

### 1.1 النمط المعماري

النظام يتبع نمط **Monolith معياري (Modular Monolith)** مع فصل واضح بين الطبقات:

```
┌─────────────────────────────────────────────────────────────────┐
│                     المتصفح (Arabic RTL SPA)                     │
│                    React 19 + Vite 8 + React Router              │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP / JSON
                               │ api/v1/*
┌──────────────────────────────▼──────────────────────────────────┐
│                        الواجهة الخلفية                           │
│                     NestJS 11 + Prisma 5                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│  │  Auth     │ │  Topics   │ │ Meetings  │ │ Decisions │       │
│  │  Module   │ │  Module   │ │  Module   │ │  Module   │       │
│  ├───────────┤ ├───────────┤ ├───────────┤ ├───────────┤       │
│  │  Users    │ │  Exams    │ │  Minutes  │ │  Notifs   │       │
│  │  Module   │ │  Module   │ │  Module   │ │  Module   │       │
│  ├───────────┤ ├───────────┤ ├───────────┤ ├───────────┤       │
│  │ Delegation│ │  Councils │ │  Agenda   │ │  Audit    │       │
│  │  Module   │ │  Module   │ │  Module   │ │  Module   │       │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Shared / Core Layer                      │       │
│  │  Guards · Interceptors · Pipes · Filters · Prisma     │       │
│  └──────────────────────────────────────────────────────┘       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   SQLite (dev)      │
                    │   PostgreSQL (prod) │
                    └─────────────────────┘
```

### 1.2 طبقات التطبيق

| الطبقة | المسؤولية |
|--------|-----------|
| **Controller** | استقبال الطلبات، التحقق من المدخلات (DTOs + ValidationPipe)، إرجاع الاستجابة |
| **Service** | منطق الأعمال، التحقق من الصلاحيات، انتقالات الحالة، تسجيل التدقيق |
| **Repository (Prisma)** | الوصول لقاعدة البيانات عبر Prisma Client |
| **Guards** | المصادقة (`AuthGuard`) والتفويض (`RolesGuard`, `ClearanceGuard`) |
| **Interceptors** | `AuditInterceptor` لتسجيل التدقيق التلقائي، `VisibilityInterceptor` للعزل الظاهري |

### 1.3 مبادئ التصميم

1. **رفض افتراضي (Deny by Default):** كل endpoint محمي؛ يُمنح الوصول صراحةً عبر decorators
2. **مصدر حقيقة واحد:** لا نسخ مزدوجة للبيانات؛ العزل الظاهري في طبقة العرض فقط
3. **سجل تدقيق غير قابل للحذف:** كل انتقال حالة يُنشئ سجل `AuditLog`
4. **فصل الوحدات:** كل عملية رئيسية (PRD §5) في وحدة NestJS مستقلة
5. **التهيئة خارج الكود:** المعلمات في `SystemConfig` بدلاً من ثوابت مُجمّعة

---

## 2. المكدس التقني

### 2.1 الاختيارات المعتمدة

| المكوّن | التقنية | الإصدار | المبرر |
|---------|---------|---------|--------|
| **الواجهة الخلفية** | NestJS | 11.x | إطار مؤسسي، وحدات منظمة، Guards/Interceptors مدمجة |
| **ORM** | Prisma | 5.x | Type-safe، migrations مدمجة، دعم SQLite + PostgreSQL |
| **قاعدة البيانات (تطوير)** | SQLite | — | لا يحتاج Docker، سريع للتطوير المحلي |
| **قاعدة البيانات (إنتاج)** | PostgreSQL | 16+ | أداء عالٍ، دعم JSON، تزامن، نسخ احتياطي |
| **الواجهة الأمامية** | React | 19.x | مكتبة ناضجة، نظام بيئي واسع |
| **أداة البناء** | Vite | 8.x | سرعة تطوير عالية، HMR فوري |
| **مكتبة المكونات** | Ant Design (antd) | 5.x | دعم RTL مدمج، مكونات جداول ونماذج غنية |
| **إدارة الحالة** | Zustand | 5.x | خفيف، بسيط، كافٍ لـ MVP |
| **طلبات HTTP** | TanStack Query (React Query) | 5.x | تخزين مؤقت، إعادة محاولة، تتبع حالة الطلبات |
| **التوجيه** | React Router | 7.x | توجيه معياري مع حماية المسارات |
| **إدارة المرفقات** | تخزين محلي (disk) | — | MVP؛ يُنقل لـ S3/MinIO في الإنتاج |
| **اللغة** | TypeScript | 5.x/6.x | أمان الأنواع في الطرفين |

### 2.2 هيكل المشروع

```
board/
├── PRD.md
├── TDD.md
├── package.json                 # workspace root (scripts مشتركة)
├── docker-compose.yml
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── uploads/                 # تخزين مرفقات محلي
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── prisma/              # PrismaModule + PrismaService
│       ├── health/              # HealthModule (موجود)
│       ├── auth/                # المصادقة + Guards
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── guards/
│       │   │   ├── jwt-auth.guard.ts
│       │   │   ├── roles.guard.ts
│       │   │   └── clearance.guard.ts
│       │   ├── decorators/
│       │   │   ├── roles.decorator.ts
│       │   │   ├── current-user.decorator.ts
│       │   │   └── require-clearance.decorator.ts
│       │   └── dto/
│       ├── users/               # إدارة المستخدمين والأدوار
│       │   ├── users.module.ts
│       │   ├── users.controller.ts
│       │   ├── users.service.ts
│       │   └── dto/
│       ├── councils/            # إدارة المجالس
│       ├── org-units/           # الوحدات التنظيمية
│       ├── topics/              # رفع واستقبال المواضيع
│       │   ├── topics.module.ts
│       │   ├── topics.controller.ts
│       │   ├── topics.service.ts
│       │   ├── topics-workflow.service.ts   # آلة الحالات
│       │   ├── attachments.controller.ts
│       │   └── dto/
│       ├── examinations/        # الفحص
│       ├── agenda/              # صندوق الأجندة
│       ├── meetings/            # الاجتماعات
│       ├── minutes/             # المحاضر
│       ├── decisions/           # القرارات
│       ├── notifications/       # التبليغات والإشعارات
│       ├── delegations/         # التفويض
│       ├── audit/               # سجل التدقيق
│       ├── dashboard/           # لوحة المعلومات
│       ├── config/              # معلمات التهيئة (SystemConfig)
│       └── shared/
│           ├── interceptors/
│           │   ├── audit.interceptor.ts
│           │   └── visibility.interceptor.ts
│           ├── filters/
│           │   └── http-exception.filter.ts
│           ├── pipes/
│           └── constants/
│               └── states.ts    # ثوابت الحالات
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── router.tsx           # تعريف المسارات
│       ├── lib/
│       │   ├── api.ts           # axios/fetch wrapper
│       │   ├── auth.ts          # حالة المصادقة
│       │   └── query-client.ts
│       ├── types/               # أنواع TypeScript مشتركة
│       ├── layout/
│       │   ├── AppLayout.tsx    # الهيكل العام (sidebar + header)
│       │   ├── Sidebar.tsx
│       │   └── Header.tsx
│       ├── pages/
│       │   ├── login/
│       │   ├── dashboard/
│       │   ├── topics/          # إنشاء / قائمة / تفاصيل
│       │   ├── inbox/           # وارد الأمانة العامة
│       │   ├── examinations/
│       │   ├── agenda/
│       │   ├── meetings/
│       │   ├── minutes/
│       │   ├── decisions/
│       │   ├── notifications/
│       │   ├── delegations/
│       │   └── admin/           # إدارة النظام
│       │       ├── users/
│       │       ├── councils/
│       │       ├── org-units/
│       │       ├── config/
│       │       └── audit/
│       └── components/
│           ├── StatusBadge.tsx
│           ├── WorkflowTimeline.tsx
│           ├── AttachmentUploader.tsx
│           ├── ConfidentialityTag.tsx
│           └── AuditTrail.tsx
```

---

## 3. نموذج البيانات التفصيلي

### 3.1 مخطط العلاقات (ERD نصي)

```
OrganizationUnit ──1:N──► User
OrganizationUnit ──1:N──► Topic (requesting)

SecretLevel ──1:N──► User (maxClearance)
SecretLevel ──1:N──► Topic (secrecyLevel)

User ──1:N──► UserRole ◄──N:1── Role
                 │
                 └──── ◄──N:1── Council (optional scope)

User ──1:N──► Delegation (from)
User ──1:N──► Delegation (to)
User ──1:N──► Topic (createdBy)

Council ──1:N──► Topic
Council ──1:N──► Meeting
Council ──1:N──► UserRole

Topic ──1:N──► TopicAttachment
Topic ──1:N──► TopicStatusLog
Topic ──1:N──► Examination
Topic ──1:N──► MeetingTopicLink
Topic ──1:N──► Decision
Topic ──1:N──► GSReview

Meeting ──1:N──► MeetingTopicLink
Meeting ──1:1──► Minutes

Minutes ──1:N──► MinuteMemberFeedback
Minutes ──1:N──► Decision

Decision ──1:N──► Notification
Notification ──1:N──► NotificationDeliveryAttempt

AuditLog (standalone — polymorphic via entityType + entityId)
SystemConfig (standalone — key/value pairs)
```

### 3.2 تفصيل الكيانات — الأعمدة والقيود

> **الترميز:** `PK` = مفتاح أساسي · `FK` = مفتاح أجنبي · `UQ` = فريد · `IX` = فهرس · `NN` = غير فارغ · `DF` = قيمة افتراضية

---

#### 3.2.1 `OrganizationUnit` — الوحدة التنظيمية (الإدارة)

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | معرّف فريد |
| `name` | `String` | NN | اسم الإدارة بالعربي |
| `code` | `String` | UQ, Nullable | رمز مختصر (مثل `IT`, `FIN`) |
| `parentId` | `String` | FK → self, Nullable | للتسلسل الهرمي المستقبلي |
| `isActive` | `Boolean` | NN, DF(true) | تعطيل بدون حذف |
| `createdAt` | `DateTime` | NN, DF(now) | |
| `updatedAt` | `DateTime` | NN, auto | |

---

#### 3.2.2 `SecretLevel` — مستوى السرية

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `name` | `String` | NN | مثال: عام، داخلي، سري |
| `sortOrder` | `Int` | UQ, NN | الترتيب التصاعدي (1=الأدنى) — المقارنة الرقمية |
| `createdAt` | `DateTime` | NN, DF(now) | |
| `updatedAt` | `DateTime` | NN, auto | |

**القاعدة:** `user.maxClearance.sortOrder >= topic.secrecyLevel.sortOrder` للسماح بالوصول.

---

#### 3.2.3 `User` — المستخدم

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `email` | `String` | UQ, NN | البريد الإلكتروني — معرّف تسجيل الدخول |
| `passwordHash` | `String` | NN | bcrypt hash — للمصادقة المحلية في MVP |
| `displayName` | `String` | NN | الاسم بالعربي |
| `isActive` | `Boolean` | NN, DF(true) | تعطيل بدون حذف |
| `organizationId` | `String` | FK → OrganizationUnit, Nullable | الإدارة التابع لها |
| `maxClearanceId` | `String` | FK → SecretLevel, Nullable | أقصى مستوى سرية |
| `createdAt` | `DateTime` | NN, DF(now) | |
| `updatedAt` | `DateTime` | NN, auto | |

**ملاحظة:** `passwordHash` للـ MVP فقط. في الإنتاج يُستبدل بـ SSO/LDAP (PRD §8.2).

---

#### 3.2.4 `Role` — الدور الوظيفي

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `code` | `String` | UQ, NN | معرّف ثابت في الكود |
| `labelAr` | `String` | NN | التسمية بالعربي |
| `createdAt` | `DateTime` | NN, DF(now) | |
| `updatedAt` | `DateTime` | NN, auto | |

**القيم المعتمدة (Seed Data):**

| `code` | `labelAr` | مرجع PRD |
|--------|-----------|-----------|
| `DEPT_STAFF` | موظف إداري مختص | §2.3 |
| `DEPT_MANAGER` | مدير الإدارة | §2.3 |
| `GENERAL_SECRETARY` | الأمين العام | §2.3 |
| `COUNCIL_SECRETARY` | أمين المجلس | §2.3 |
| `EXAM_OFFICER` | موظف فحص | §2.3 |
| `COUNCIL_PRESIDENT` | رئيس المجلس | §2.3 |
| `COUNCIL_MEMBER` | عضو مجلس | §2.3 |
| `SYSTEM_ADMIN` | مدير النظام | §2.3 |

---

#### 3.2.5 `UserRole` — ربط المستخدم بالدور

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `userId` | `String` | FK → User, NN | |
| `roleId` | `String` | FK → Role, NN | |
| `councilId` | `String` | FK → Council, Nullable | `NULL` = دور عام (مثل GENERAL_SECRETARY) |
| `createdAt` | `DateTime` | NN, DF(now) | |

**القيود:**
- `@@unique([userId, roleId, councilId])` — لا تكرار
- أدوار مرتبطة بمجلس: `COUNCIL_SECRETARY`, `EXAM_OFFICER`, `COUNCIL_PRESIDENT`, `COUNCIL_MEMBER`
- أدوار عامة (councilId = null): `DEPT_STAFF`, `DEPT_MANAGER`, `GENERAL_SECRETARY`, `SYSTEM_ADMIN`

---

#### 3.2.6 `Delegation` — التفويض

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `state` | `String` | NN, DF(`DELEGATION_DRAFT`) | حالة التفويض (PRD §7.1) |
| `fromUserId` | `String` | FK → User, NN | المُفوِّض |
| `toUserId` | `String` | FK → User, NN | المُفوَّض |
| `scopeType` | `String` | NN | `FULL_ROLE` \| `SPECIFIC_OPERATION` \| `TOPIC_TYPE` |
| `scopeJson` | `String (JSON)` | NN | تفاصيل النطاق |
| `validFrom` | `DateTime` | NN | بداية الصلاحية |
| `validUntil` | `DateTime` | NN | نهاية الصلاحية |
| `reason` | `String` | Nullable | سبب التفويض |
| `createdAt` | `DateTime` | NN, DF(now) | |
| `updatedAt` | `DateTime` | NN, auto | |

**حالات التفويض (PRD §7.1):**

| الحالة | المعنى |
|--------|--------|
| `DELEGATION_DRAFT` | مسودة |
| `PENDING_ACTIVATION` | مجدولة |
| `ACTIVE` | ساري |
| `SUSPENDED` | موقوف مؤقتاً |
| `EXPIRED` | انتهت صلاحيته (آلياً) |
| `REVOKED` | ملغى صراحةً |
| `SUPERSEDED` | استُبدل بأحدث |

**مثال `scopeJson`:**
```json
// FULL_ROLE
{ "roleCode": "GENERAL_SECRETARY" }

// SPECIFIC_OPERATION
{ "roleCode": "COUNCIL_SECRETARY", "operations": ["EXAM_ASSIGN", "MINUTES_PREPARE"], "councilId": "..." }

// TOPIC_TYPE
{ "roleCode": "COUNCIL_SECRETARY", "councilId": "...", "topicClassification": "financial" }
```

**قيد تزاحم:** لا يجوز وجود تفويضين `ACTIVE` لنفس `(toUserId, scopeType, scopeJson.roleCode, scopeJson.councilId)`.

---

#### 3.2.7 `Council` — المجلس

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `name` | `String` | NN | اسم المجلس بالعربي |
| `code` | `String` | UQ, NN | رمز مختصر (`HIRING`, `FINANCE`, `TECH`, `OPS`, `MARKETING`) |
| `isActive` | `Boolean` | NN, DF(true) | |
| `createdAt` | `DateTime` | NN, DF(now) | |
| `updatedAt` | `DateTime` | NN, auto | |

**البيانات الأولية (Seed Data):**

| `code` | `name` |
|--------|--------|
| `HIRING` | مجلس التوظيف |
| `FINANCE` | مجلس المالية |
| `TECH` | مجلس التقنية |
| `OPS` | مجلس التشغيل |
| `MARKETING` | مجلس التسويق |

---

#### 3.2.8 `Topic` — الموضوع

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `refNumber` | `String` | UQ, NN, Auto-generated | رقم مرجعي تسلسلي (مثل `TOP-2026-00001`) |
| `title` | `String` | NN | عنوان الموضوع (PRD §3) |
| `status` | `String` | NN, DF(`DRAFT`) | الحالة الحالية |
| `secrecyLevelId` | `String` | FK → SecretLevel, NN | درجة السرية (PRD §3) |
| `councilId` | `String` | FK → Council, NN | المجلس المستهدف (PRD §3) |
| `requestingOrgId` | `String` | FK → OrganizationUnit, NN | الإدارة الطالبة |
| `createdById` | `String` | FK → User, NN | الموظف المُنشئ |
| `currentVersion` | `Int` | NN, DF(1) | نسخة الموضوع (تزداد عند الإعادة) |
| `returnType` | `String` | Nullable | نوع الإعادة: `FULL_REEXAM` \| `PATH_CORRECTION` (PRD §6.4) |
| `agendaOrder` | `Int` | Nullable | ترتيب في صندوق الأجندة (FIFO أو يدوي) |
| `agendaEnteredAt` | `DateTime` | Nullable | تاريخ دخول صندوق الأجندة (لحساب FIFO) |
| `createdAt` | `DateTime` | NN, DF(now) | |
| `updatedAt` | `DateTime` | NN, auto | |

**الفهارس:**
- `@@index([councilId, status])` — تصفية حسب المجلس والحالة
- `@@index([requestingOrgId])` — مواضيع الإدارة
- `@@index([status, agendaEnteredAt])` — ترتيب صندوق الأجندة

---

#### 3.2.9 `TopicStatusLog` — سجل انتقالات حالة الموضوع

> كيان **جديد** غير موجود في Prisma الحالي — يُضاف لتتبع تاريخ الحالات.

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `topicId` | `String` | FK → Topic, NN | |
| `fromStatus` | `String` | Nullable | الحالة السابقة (`NULL` عند الإنشاء) |
| `toStatus` | `String` | NN | الحالة الجديدة |
| `action` | `String` | NN | الإجراء المُنفَّذ (مثل `SUBMIT`, `APPROVE`, `REJECT`) |
| `actorId` | `String` | FK → User, NN | المُنفِّذ الفعلي |
| `delegationId` | `String` | FK → Delegation, Nullable | التفويض المُستخدم (إن وُجد) |
| `reason` | `String` | Nullable | السبب (إلزامي عند الرفض/الإعادة/التعليق) |
| `version` | `Int` | NN | نسخة الموضوع عند الانتقال |
| `createdAt` | `DateTime` | NN, DF(now) | |

---

#### 3.2.10 `TopicAttachment` — المرفقات

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `topicId` | `String` | FK → Topic, NN | |
| `fileKey` | `String` | NN | مسار/معرّف التخزين |
| `fileName` | `String` | NN | اسم الملف الأصلي |
| `mimeType` | `String` | Nullable | نوع الملف |
| `sizeBytes` | `Int` | Nullable | حجم الملف |
| `uploadedById` | `String` | FK → User, NN | من رفع الملف |
| `createdAt` | `DateTime` | NN, DF(now) | |

**القيود:** عند إرسال الموضوع (`SENT_TO_GS`) يُتحقق أن `count(attachments) >= SystemConfig.MIN_ATTACHMENTS_COUNT`.

---

#### 3.2.11 `GSReview` — مراجعة الأمين العام

> كيان **جديد** — يسجل كل قرار للأمين العام على الموضوع.

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `topicId` | `String` | FK → Topic, NN | |
| `reviewerId` | `String` | FK → User, NN | الأمين العام أو مفوَّضه |
| `action` | `String` | NN | `ACCEPT` \| `SUSPEND` \| `REJECT` \| `RETURN_WRONG_COUNCIL` |
| `reason` | `String` | NN (عند REJECT/RETURN) | السبب الإلزامي |
| `delegationId` | `String` | FK → Delegation, Nullable | |
| `createdAt` | `DateTime` | NN, DF(now) | |

---

#### 3.2.12 `Examination` — سجل الفحص

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `topicId` | `String` | FK → Topic, NN | |
| `examinerId` | `String` | FK → User, NN | موظف الفحص |
| `assignedById` | `String` | FK → User, NN | أمين المجلس الذي أسند الفحص |
| `result` | `String` | NN | `COMPLETE` \| `INCOMPLETE` |
| `reasons` | `String` | Nullable (إلزامي عند INCOMPLETE) | أسباب عدم الاكتمال |
| `version` | `Int` | NN | نسخة الموضوع عند الفحص |
| `createdAt` | `DateTime` | NN, DF(now) | |

---

#### 3.2.13 `Meeting` — الاجتماع

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `refNumber` | `String` | UQ, NN, Auto | رقم مرجعي (مثل `MTG-TECH-2026-001`) |
| `councilId` | `String` | FK → Council, NN | |
| `status` | `String` | NN, DF(`MEETING_DRAFT_SEC`) | حالة الاجتماع |
| `title` | `String` | Nullable | عنوان/وصف |
| `scheduledAt` | `DateTime` | Nullable | الموعد المخطط |
| `heldAt` | `DateTime` | Nullable | وقت الانعقاد الفعلي |
| `location` | `String` | Nullable | مكان الانعقاد |
| `createdById` | `String` | FK → User, NN | أمين المجلس المُنشئ |
| `createdAt` | `DateTime` | NN, DF(now) | |
| `updatedAt` | `DateTime` | NN, auto | |

---

#### 3.2.14 `MeetingTopicLink` — ربط الموضوع بالاجتماع

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `meetingId` | `String` | FK → Meeting, NN | |
| `topicId` | `String` | FK → Topic, NN | |
| `orderIndex` | `Int` | NN, DF(0) | ترتيب في جدول الأعمال |
| `slotStatus` | `String` | NN, DF(`SCHEDULED`) | `SCHEDULED` \| `DISCUSSED` \| `DEFERRED` |

**القيود:** `@@unique([meetingId, topicId])` — لا ربط مزدوج.

---

#### 3.2.15 `Minutes` — المحضر

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `meetingId` | `String` | FK → Meeting, UQ, NN | محضر واحد لكل اجتماع |
| `status` | `String` | NN, DF(`MIN_DRAFT`) | |
| `body` | `String (Text)` | Nullable | نص المحضر |
| `feedbackDeadline` | `DateTime` | Nullable | موعد إغلاق المرئيات |
| `signedAt` | `DateTime` | Nullable | تاريخ التوقيع |
| `signedById` | `String` | FK → User, Nullable | رئيس المجلس الموقّع |
| `createdAt` | `DateTime` | NN, DF(now) | |
| `updatedAt` | `DateTime` | NN, auto | |

---

#### 3.2.16 `MinuteMemberFeedback` — مرئيات الأعضاء

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `minutesId` | `String` | FK → Minutes, NN | |
| `memberId` | `String` | FK → User, NN | العضو |
| `comment` | `String (Text)` | NN | نص المرئية |
| `createdAt` | `DateTime` | NN, DF(now) | |

**القاعدة:** المرئيات مرئية لبعض الأعضاء على نفس المحضر (PRD §10.2).

---

#### 3.2.17 `Decision` — القرار

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `refNumber` | `String` | UQ, NN, Auto | رقم القرار (مثل `DEC-TECH-2026-001`) |
| `topicId` | `String` | FK → Topic, NN | |
| `minutesId` | `String` | FK → Minutes, Nullable | |
| `status` | `String` | NN, DF(`DEC_DRAFT`) | `DEC_DRAFT` \| `DEC_ISSUED` |
| `summary` | `String (Text)` | Nullable | ملخص/نص القرار |
| `issuedAt` | `DateTime` | Nullable | تاريخ الإصدار |
| `issuedById` | `String` | FK → User, Nullable | رئيس المجلس المُصدِر |
| `createdAt` | `DateTime` | NN, DF(now) | |
| `updatedAt` | `DateTime` | NN, auto | |

**القيود:**
- لا يُصدر (`DEC_ISSUED`) إلا بعد `Minutes.status = MIN_SIGNED`
- لا مسار إلغاء/استبدال في v1 (PRD §10.1)

---

#### 3.2.18 `Notification` — التبليغ

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `type` | `String` | NN | `DECISION_NOTIFICATION` \| `WORKFLOW_ALERT` \| `SYSTEM_ALERT` |
| `status` | `String` | NN, DF(`NOTIF_PENDING`) | |
| `decisionId` | `String` | FK → Decision, Nullable | القرار المبلَّغ |
| `recipientId` | `String` | FK → User, NN | المستلم |
| `recipientOrgId` | `String` | FK → OrganizationUnit, Nullable | الإدارة المستلمة |
| `title` | `String` | NN | عنوان الإشعار |
| `body` | `String (Text)` | Nullable | تفاصيل |
| `readAt` | `DateTime` | Nullable | وقت القراءة |
| `retryCount` | `Int` | NN, DF(0) | عدد المحاولات المُنفَّذة |
| `nextRetryAt` | `DateTime` | Nullable | موعد المحاولة التالية |
| `createdAt` | `DateTime` | NN, DF(now) | |
| `updatedAt` | `DateTime` | NN, auto | |

---

#### 3.2.19 `NotificationDeliveryAttempt` — محاولات التسليم

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `notificationId` | `String` | FK → Notification, NN | |
| `attemptNumber` | `Int` | NN | رقم المحاولة |
| `result` | `String` | NN | `SUCCESS` \| `FAIL` |
| `errorDetail` | `String` | Nullable | تفاصيل الخطأ عند الفشل |
| `attemptedAt` | `DateTime` | NN, DF(now) | |

---

#### 3.2.20 `AuditLog` — سجل التدقيق

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `entityType` | `String` | NN | اسم الكيان (`Topic`, `Meeting`, `Minutes`, …) |
| `entityId` | `String` | NN | معرّف الكيان |
| `action` | `String` | NN | الإجراء (`CREATE`, `STATUS_CHANGE`, `UPDATE`, `DELETE`, `ADMIN_INTERVENE`) |
| `actorActualId` | `String` | FK → User, NN | الفاعل الفعلي |
| `actorDisplayId` | `String` | FK → User, NN | الفاعل الظاهر (للعزل PRD §13) |
| `visibilityProfile` | `String` | NN, DF(`FULL_AUDIT`) | `FULL_AUDIT` \| `PRESIDENT_ISOLATED` |
| `delegationId` | `String` | FK → Delegation, Nullable | التفويض المُستخدم |
| `reason` | `String` | Nullable | السبب (إلزامي عند التدخل الاستثنائي) |
| `beforeJson` | `String (Text)` | Nullable | الحالة قبل التغيير (JSON) |
| `afterJson` | `String (Text)` | Nullable | الحالة بعد التغيير (JSON) |
| `ipAddress` | `String` | Nullable | عنوان IP المُنفِّذ |
| `createdAt` | `DateTime` | NN, DF(now) | |

**الفهارس:**
- `@@index([entityType, entityId])` — البحث حسب الكيان
- `@@index([actorActualId, createdAt])` — سجل المستخدم
- `@@index([createdAt])` — ترتيب زمني

**القيود:** لا يمتلك أي مستخدم (بما فيه مدير النظام) صلاحية `DELETE` على هذا الجدول (PRD §8.2). يُنفَّذ ذلك بعدم وجود endpoint حذف وبـ database-level policy إن أمكن.

---

#### 3.2.21 `SystemConfig` — معلمات التهيئة

> كيان **جديد** — لتخزين المعلمات القابلة للتعديل (PRD §14).

| العمود | النوع | القيود | الوصف |
|--------|-------|--------|-------|
| `id` | `String (cuid)` | PK | |
| `key` | `String` | UQ, NN | مفتاح المعلمة |
| `value` | `String` | NN | القيمة (نص — يُحوَّل حسب النوع) |
| `valueType` | `String` | NN, DF(`STRING`) | `STRING` \| `INT` \| `BOOLEAN` \| `JSON` |
| `description` | `String` | Nullable | وصف المعلمة |
| `updatedAt` | `DateTime` | NN, auto | |
| `updatedById` | `String` | FK → User, Nullable | آخر من عدّل |

---

### 3.3 صيغة الترقيم التلقائي

| الكيان | النمط | مثال |
|--------|-------|------|
| الموضوع | `TOP-{YYYY}-{NNNNN}` | `TOP-2026-00001` |
| الاجتماع | `MTG-{COUNCIL_CODE}-{YYYY}-{NNN}` | `MTG-TECH-2026-001` |
| القرار | `DEC-{COUNCIL_CODE}-{YYYY}-{NNN}` | `DEC-FINANCE-2026-015` |

**التنفيذ:** عدّاد في `SystemConfig` أو جدول `Sequence` مستقل. يُستخدم `SELECT ... FOR UPDATE` في PostgreSQL لتجنب التكرار.

---

## 4. آلة الحالات — انتقالات الكيانات

### 4.1 حالات الموضوع (Topic)

```
DRAFT ──────────────────► PENDING_DEPT_MGR ──────► APPROVED ──────► SENT_TO_GS
  ▲                            │      ▲                │
  │         إعادة للتعديل      │      │    إلغاء اعتماد│
  └────────────────────────────┘      └────────────────┘
                                              │
                               ┌──────────────▼──────────────┐
                               │        INBOX_GS             │
                               │      (وارد الأمانة)         │
                               └──────────────┬──────────────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                   ▼                   ▼
                    GS_REVIEW ──► SUSPENDED ──┘             RETURNED_DEPT
                          │                                    ▲  │
                          │                                    │  └► CLOSED_BY_DEPT
                          ▼                                    │
                    WITH_COUNCIL                               │
                          │                                    │
                          ▼                                    │
                  EXAM_IN_PROGRESS                             │
                     │         │                               │
                     ▼         ▼                               │
              EXAM_COMPLETE  EXAM_INCOMPLETE ──► (تصحيح) ──────┘
                     │                      └──► EXAM_IN_PROGRESS
                     ▼
              PRESIDENT_REVIEW
                  │         │
                  ▼         ▼
           IN_AGENDA_BOX   RETURNED_COUNCIL ──► (معالجة) ──► PRESIDENT_REVIEW
                  │
                  ▼
            LINKED_TO_MEETING ──► DEFERRED_IN_SESSION ──► IN_AGENDA_BOX
                  │
                  ▼
              DISCUSSED
                  │
                  ▼
           DECISION_PENDING ──► DECISION_ISSUED ──► NOTIFIED
```

### 4.2 جدول الانتقالات المسموحة — الموضوع

| من | إلى | الإجراء | الصلاحية | سبب إلزامي | مرجع PRD |
|----|------|---------|----------|------------|----------|
| `DRAFT` | `PENDING_DEPT_MGR` | إرسال للاعتماد | `DEPT_STAFF` في نفس الإدارة | لا | §9.1 |
| `PENDING_DEPT_MGR` | `APPROVED` | اعتماد | `DEPT_MANAGER` في نفس الإدارة | لا | §9.1 |
| `PENDING_DEPT_MGR` | `DRAFT` | إعادة للتعديل | `DEPT_MANAGER` | **نعم** | §9.8.3 |
| `APPROVED` | `SENT_TO_GS` | إرسال للأمانة | `DEPT_MANAGER` | لا | §9.1 |
| `APPROVED` | `DRAFT` | إلغاء اعتماد | `DEPT_MANAGER` | لا | §6.5 |
| `SENT_TO_GS` | `INBOX_GS` | استلام (تلقائي) | النظام | لا | §9.2 |
| `INBOX_GS` | `GS_REVIEW` | بدء المراجعة | `GENERAL_SECRETARY` | لا | §9.2 |
| `GS_REVIEW` | `WITH_COUNCIL` | قبول | `GENERAL_SECRETARY` | لا | §9.8.4 |
| `GS_REVIEW` | `SUSPENDED` | تعليق | `GENERAL_SECRETARY` | **نعم** | §9.8.4 |
| `GS_REVIEW` | `RETURNED_DEPT` | رفض | `GENERAL_SECRETARY` | **نعم** | §9.8.4 |
| `GS_REVIEW` | `RETURNED_DEPT` | إعادة (مجلس غير مناسب) | `GENERAL_SECRETARY` | **نعم** | §9.8.4 |
| `SUSPENDED` | `GS_REVIEW` | استئناف | `GENERAL_SECRETARY` | لا | §9.8.4 |
| `RETURNED_DEPT` | `SENT_TO_GS` | إعادة إرسال | `DEPT_MANAGER` | لا | §9.8.4 |
| `RETURNED_DEPT` | `CLOSED_BY_DEPT` | إغلاق/أرشفة | `DEPT_MANAGER` | لا | §10.4 |
| `WITH_COUNCIL` | `EXAM_IN_PROGRESS` | إسناد الفحص | `COUNCIL_SECRETARY` | لا | §6.3 |
| `EXAM_IN_PROGRESS` | `EXAM_COMPLETE` | فحص مكتمل | `EXAM_OFFICER` | لا | §9.8.4 |
| `EXAM_IN_PROGRESS` | `EXAM_INCOMPLETE` | فحص غير مكتمل | `EXAM_OFFICER` | **نعم** | §9.8.4 |
| `EXAM_INCOMPLETE` | `EXAM_IN_PROGRESS` | إعادة فحص | `COUNCIL_SECRETARY` | لا | §9.8.4 |
| `EXAM_COMPLETE` | `PRESIDENT_REVIEW` | عرض على الرئيس | `COUNCIL_SECRETARY` | لا | §9.2 |
| `PRESIDENT_REVIEW` | `IN_AGENDA_BOX` | مناسب | `COUNCIL_PRESIDENT` | لا | §6.4 |
| `PRESIDENT_REVIEW` | `RETURNED_COUNCIL` | إعادة | `COUNCIL_PRESIDENT` | **نعم** + نوع الإعادة | §6.4 |
| `RETURNED_COUNCIL` | `EXAM_IN_PROGRESS` | إعادة فحص كاملة | `COUNCIL_SECRETARY` | لا | §6.4 |
| `RETURNED_COUNCIL` | `PRESIDENT_REVIEW` | تصحيح مسار فقط | `COUNCIL_SECRETARY` | لا | §6.4 |
| `IN_AGENDA_BOX` | `LINKED_TO_MEETING` | ربط باجتماع | `COUNCIL_SECRETARY` | لا | §6.5 |
| `LINKED_TO_MEETING` | `IN_AGENDA_BOX` | سحب من الاجتماع | `COUNCIL_SECRETARY` | لا | §6.5 |
| `LINKED_TO_MEETING` | `DISCUSSED` | مناقشة | النظام (بعد الانعقاد) | لا | §9.3 |
| `LINKED_TO_MEETING` | `DEFERRED_IN_SESSION` | تأجيل داخل الجلسة | `COUNCIL_PRESIDENT` | لا | §6.5 |
| `DEFERRED_IN_SESSION` | `IN_AGENDA_BOX` | إعادة للصندوق | النظام | لا | §6.5 |

### 4.3 حالات الاجتماع (Meeting)

| من | إلى | الإجراء | الصلاحية |
|----|------|---------|----------|
| `MEETING_DRAFT_SEC` | `MEETING_GS_APPROVAL` | إرسال للأمين العام | `COUNCIL_SECRETARY` |
| `MEETING_GS_APPROVAL` | `MEETING_BACK_SEC` | موافقة | `GENERAL_SECRETARY` |
| `MEETING_GS_APPROVAL` | `MEETING_DRAFT_SEC` | إعادة للتعديل | `GENERAL_SECRETARY` |
| `MEETING_BACK_SEC` | `MEETING_PRES_APPROVAL` | إرسال للرئيس | `COUNCIL_SECRETARY` |
| `MEETING_PRES_APPROVAL` | `MEETING_SCHEDULED` | اعتماد | `COUNCIL_PRESIDENT` |
| `MEETING_PRES_APPROVAL` | `MEETING_BACK_SEC` | إعادة | `COUNCIL_PRESIDENT` |
| `MEETING_SCHEDULED` | `MEETING_HELD` | إقفال الجلسة | `COUNCIL_SECRETARY` |
| `MEETING_SCHEDULED` | `MEETING_ADJOURNED` | تأجيل | `COUNCIL_SECRETARY` |
| `MEETING_SCHEDULED` | `MEETING_CANCELLED` | إلغاء | `COUNCIL_SECRETARY` |

**عند `MEETING_ADJOURNED` أو `MEETING_CANCELLED`:** جميع المواضيع المربوطة تعود إلى `IN_AGENDA_BOX`.

### 4.4 حالات المحضر (Minutes)

| من | إلى | الإجراء | الصلاحية |
|----|------|---------|----------|
| `MIN_DRAFT` | `MIN_GS_REVIEW` | إرسال للأمين العام | `COUNCIL_SECRETARY` |
| `MIN_GS_REVIEW` | `MIN_GS_RETURNED` | طلب تعديل | `GENERAL_SECRETARY` |
| `MIN_GS_REVIEW` | `MIN_MEMBERS_CONSULT` | موافقة | `GENERAL_SECRETARY` |
| `MIN_GS_RETURNED` | `MIN_GS_REVIEW` | إعادة إرسال | `COUNCIL_SECRETARY` |
| `MIN_MEMBERS_CONSULT` | `MIN_TO_PRESIDENT` | إغلاق المرئيات | `COUNCIL_SECRETARY` أو انتهاء المهلة |
| `MIN_TO_PRESIDENT` | `MIN_SIGNED` | توقيع | `COUNCIL_PRESIDENT` |
| `MIN_TO_PRESIDENT` | `MIN_PRES_REJECT` | رفض التوقيع | `COUNCIL_PRESIDENT` |
| `MIN_PRES_REJECT` | `MIN_GS_REVIEW` | تعديل عند الأمين العام | `GENERAL_SECRETARY` |

### 4.5 حالات القرار (Decision)

| من | إلى | الإجراء | الصلاحية |
|----|------|---------|----------|
| `DEC_DRAFT` | `DEC_ISSUED` | إصدار | `COUNCIL_PRESIDENT` (بعد `MIN_SIGNED`) |

### 4.6 حالات التبليغ (Notification)

| من | إلى | الإجراء | الصلاحية |
|----|------|---------|----------|
| `NOTIF_PENDING` | `NOTIF_DONE` | تم التبليغ | `GENERAL_SECRETARY` أو النظام |
| `NOTIF_PENDING` | `NOTIF_FAIL` | فشل | النظام |
| `NOTIF_FAIL` | `NOTIF_PENDING` | إعادة محاولة | النظام أو `GENERAL_SECRETARY` |
| `NOTIF_FAIL` | `NOTIF_DONE` | تسوية يدوية | `GENERAL_SECRETARY` أو `SYSTEM_ADMIN` |

---

## 5. تصميم واجهة برمجة التطبيقات — رفع الموضوع

### 5.1 بادئة عامة

جميع الـ endpoints تحت البادئة: `api/v1`

**Headers مطلوبة:**
```
Authorization: Bearer <JWT>
Content-Type: application/json
```

**شكل الاستجابة الموحد:**
```json
// نجاح
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 150 }
}

// خطأ
{
  "success": false,
  "error": {
    "code": "TOPIC_INVALID_TRANSITION",
    "message": "لا يمكن الانتقال من DRAFT إلى APPROVED مباشرة",
    "details": { ... }
  }
}
```

### 5.2 إدارة المواضيع (Topics)

#### `POST /api/v1/topics` — إنشاء موضوع (مسودة)

**الصلاحية:** `DEPT_STAFF` أو `DEPT_MANAGER`

**الطلب:**
```json
{
  "title": "طلب توظيف مطور أنظمة",
  "councilId": "clxyz...",
  "secrecyLevelId": "clxyz..."
}
```

**الاستجابة:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "clxyz...",
    "refNumber": "TOP-2026-00001",
    "title": "طلب توظيف مطور أنظمة",
    "status": "DRAFT",
    "councilId": "clxyz...",
    "secrecyLevelId": "clxyz...",
    "requestingOrgId": "clxyz...",
    "currentVersion": 1,
    "createdAt": "2026-04-10T08:00:00Z"
  }
}
```

**القواعد:**
- `requestingOrgId` يُستنبط من `currentUser.organizationId`
- `createdById` يُستنبط من `currentUser.id`
- الحالة الابتدائية دائماً `DRAFT`

---

#### `GET /api/v1/topics` — قائمة المواضيع

**الصلاحية:** حسب الدور (كل مستخدم يرى ما يحق له فقط مع فلترة السرية)

**المعاملات (Query Params):**

| المعامل | النوع | وصف |
|---------|-------|------|
| `status` | `string` | تصفية حسب الحالة (يقبل عدة قيم مفصولة بفاصلة) |
| `councilId` | `string` | تصفية حسب المجلس |
| `orgId` | `string` | تصفية حسب الإدارة الطالبة |
| `search` | `string` | بحث في العنوان والرقم المرجعي |
| `page` | `int` | رقم الصفحة (DF: 1) |
| `limit` | `int` | عدد العناصر (DF: 20، أقصى: 100) |
| `sortBy` | `string` | حقل الترتيب (DF: `createdAt`) |
| `sortOrder` | `asc\|desc` | اتجاه الترتيب (DF: `desc`) |

**فلترة السرية (تلقائية):** النظام يُضيف شرط `topic.secrecyLevel.sortOrder <= currentUser.maxClearance.sortOrder`.

**الاستجابة:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "refNumber": "TOP-2026-00001",
      "title": "...",
      "status": "DRAFT",
      "council": { "id": "...", "name": "مجلس التوظيف" },
      "secrecyLevel": { "id": "...", "name": "داخلي" },
      "requestingOrg": { "id": "...", "name": "إدارة تقنية المعلومات" },
      "createdBy": { "id": "...", "displayName": "أحمد محمد" },
      "attachmentsCount": 2,
      "createdAt": "2026-04-10T08:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45 }
}
```

---

#### `GET /api/v1/topics/:id` — تفاصيل الموضوع

**الصلاحية:** حسب الدور + فلترة السرية

**الاستجابة:** `200 OK` — يتضمن الموضوع + المرفقات + سجل الحالات + الفحوصات

---

#### `PATCH /api/v1/topics/:id` — تعديل المسودة

**الصلاحية:** `DEPT_STAFF` أو `DEPT_MANAGER` — فقط في حالة `DRAFT`

**الطلب:**
```json
{
  "title": "عنوان معدّل",
  "councilId": "clxyz...",
  "secrecyLevelId": "clxyz..."
}
```

---

#### `POST /api/v1/topics/:id/transition` — انتقال الحالة

**الصلاحية:** حسب جدول الانتقالات (§4.2)

**الطلب:**
```json
{
  "action": "SUBMIT_TO_MANAGER",
  "reason": "سبب الإعادة أو الرفض",           // إلزامي حسب الإجراء
  "returnType": "FULL_REEXAM"                  // فقط عند إعادة رئيس المجلس
}
```

**قيم `action` المعتمدة:**

| `action` | من → إلى | الصلاحية |
|----------|----------|----------|
| `SUBMIT_TO_MANAGER` | DRAFT → PENDING_DEPT_MGR | DEPT_STAFF |
| `APPROVE` | PENDING_DEPT_MGR → APPROVED | DEPT_MANAGER |
| `RETURN_TO_DRAFT` | PENDING_DEPT_MGR → DRAFT | DEPT_MANAGER |
| `REVOKE_APPROVAL` | APPROVED → DRAFT | DEPT_MANAGER |
| `SEND_TO_GS` | APPROVED → SENT_TO_GS | DEPT_MANAGER |
| `ACCEPT` | GS_REVIEW → WITH_COUNCIL | GENERAL_SECRETARY |
| `SUSPEND` | GS_REVIEW → SUSPENDED | GENERAL_SECRETARY |
| `RESUME` | SUSPENDED → GS_REVIEW | GENERAL_SECRETARY |
| `REJECT` | GS_REVIEW → RETURNED_DEPT | GENERAL_SECRETARY |
| `RETURN_WRONG_COUNCIL` | GS_REVIEW → RETURNED_DEPT | GENERAL_SECRETARY |
| `RESUBMIT` | RETURNED_DEPT → SENT_TO_GS | DEPT_MANAGER |
| `CLOSE_BY_DEPT` | RETURNED_DEPT → CLOSED_BY_DEPT | DEPT_MANAGER |
| `ASSIGN_EXAM` | WITH_COUNCIL → EXAM_IN_PROGRESS | COUNCIL_SECRETARY |
| `EXAM_PASS` | EXAM_IN_PROGRESS → EXAM_COMPLETE | EXAM_OFFICER |
| `EXAM_FAIL` | EXAM_IN_PROGRESS → EXAM_INCOMPLETE | EXAM_OFFICER |
| `REEXAM` | EXAM_INCOMPLETE → EXAM_IN_PROGRESS | COUNCIL_SECRETARY |
| `SUBMIT_TO_PRESIDENT` | EXAM_COMPLETE → PRESIDENT_REVIEW | COUNCIL_SECRETARY |
| `MARK_SUITABLE` | PRESIDENT_REVIEW → IN_AGENDA_BOX | COUNCIL_PRESIDENT |
| `RETURN_TO_COUNCIL` | PRESIDENT_REVIEW → RETURNED_COUNCIL | COUNCIL_PRESIDENT |
| `DEFER_IN_SESSION` | LINKED_TO_MEETING → DEFERRED_IN_SESSION | COUNCIL_PRESIDENT |

**الاستجابة:** `200 OK` — الموضوع بحالته الجديدة

**منطق الخدمة (Service):**
1. التحقق من الحالة الحالية مطابقة للانتقال المطلوب
2. التحقق من صلاحية المستخدم (أو تفويضه)
3. التحقق من مستوى السرية
4. تنفيذ الانتقال
5. إنشاء `TopicStatusLog`
6. إنشاء `AuditLog`
7. إنشاء `Notification` للجهة التالية

---

### 5.3 المرفقات (Attachments)

#### `POST /api/v1/topics/:id/attachments` — رفع مرفق

**الصلاحية:** `DEPT_STAFF` أو `DEPT_MANAGER` — فقط في حالة `DRAFT`

**الطلب:** `multipart/form-data`
```
file: <binary>
```

**الاستجابة:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "...",
    "fileName": "تقرير_مالي.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 2048576
  }
}
```

**القيود:**
- أنواع مسموحة: `pdf`, `doc`, `docx`, `xls`, `xlsx`, `png`, `jpg`, `jpeg`
- حجم أقصى للملف: **10 MB** (قابل للتهيئة)
- يُخزن في `uploads/{topicId}/{uuid}.{ext}`

#### `GET /api/v1/topics/:id/attachments/:attachmentId/download` — تحميل مرفق

#### `DELETE /api/v1/topics/:id/attachments/:attachmentId` — حذف مرفق

**الصلاحية:** فقط في حالة `DRAFT`

---

## 6. تصميم API — استقبال الموضوع والفحص

### 6.1 وارد الأمانة العامة

#### `GET /api/v1/gs/inbox` — قائمة المواضيع الواردة

**الصلاحية:** `GENERAL_SECRETARY`

**يُرجع:** المواضيع بحالات `INBOX_GS`, `GS_REVIEW`, `SUSPENDED`

---

#### `POST /api/v1/gs/reviews` — تسجيل مراجعة الأمين العام

**الصلاحية:** `GENERAL_SECRETARY`

**الطلب:**
```json
{
  "topicId": "...",
  "action": "ACCEPT",
  "reason": "سبب الرفض"            // إلزامي عند REJECT/RETURN
}
```

**الإجراءات:** `ACCEPT` | `SUSPEND` | `REJECT` | `RETURN_WRONG_COUNCIL`

---

### 6.2 الفحص (Examinations)

#### `GET /api/v1/councils/:councilId/examinations` — مواضيع بانتظار الفحص

**الصلاحية:** `COUNCIL_SECRETARY` أو `EXAM_OFFICER` في المجلس

---

#### `POST /api/v1/examinations` — إسناد فحص

**الصلاحية:** `COUNCIL_SECRETARY`

**الطلب:**
```json
{
  "topicId": "...",
  "examinerId": "..."
}
```

---

#### `PATCH /api/v1/examinations/:id/result` — تسجيل نتيجة الفحص

**الصلاحية:** `EXAM_OFFICER` المُسنَد إليه

**الطلب:**
```json
{
  "result": "COMPLETE",
  "reasons": "الوثائق كاملة ومطابقة"
}
```

---

### 6.3 قرار رئيس المجلس (بعد الفحص)

> يتم عبر `POST /api/v1/topics/:id/transition` مع:
> - `action: "MARK_SUITABLE"` — للإدراج في صندوق الأجندة
> - `action: "RETURN_TO_COUNCIL"` مع `returnType` و `reason`

---

## 7. تصميم API — الاجتماعات وصندوق الأجندة

### 7.1 صندوق الأجندة (Agenda Box)

#### `GET /api/v1/councils/:councilId/agenda-box` — مواضيع صندوق الأجندة

**الصلاحية:** `COUNCIL_SECRETARY` أو `COUNCIL_PRESIDENT` في المجلس

**الترتيب الافتراضي:** `agendaEnteredAt ASC` (FIFO — PRD §6.5)

---

#### `PATCH /api/v1/councils/:councilId/agenda-box/reorder` — إعادة ترتيب

**الصلاحية:** `COUNCIL_SECRETARY`

**الطلب:**
```json
{
  "orderedTopicIds": ["id1", "id2", "id3"]
}
```

---

### 7.2 الاجتماعات (Meetings)

#### `POST /api/v1/councils/:councilId/meetings` — إنشاء اجتماع

**الصلاحية:** `COUNCIL_SECRETARY`

**الطلب:**
```json
{
  "title": "الاجتماع الثالث — مجلس التقنية",
  "scheduledAt": "2026-04-15T10:00:00Z",
  "location": "قاعة الاجتماعات الرئيسية",
  "topicIds": ["id1", "id2"]
}
```

---

#### `POST /api/v1/meetings/:id/transition` — انتقال حالة الاجتماع

**الطلب:**
```json
{
  "action": "SEND_TO_GS"
}
```

**قيم `action`:**

| `action` | من → إلى | الصلاحية |
|----------|----------|----------|
| `SEND_TO_GS` | DRAFT_SEC → GS_APPROVAL | COUNCIL_SECRETARY |
| `GS_APPROVE` | GS_APPROVAL → BACK_SEC | GENERAL_SECRETARY |
| `GS_RETURN` | GS_APPROVAL → DRAFT_SEC | GENERAL_SECRETARY |
| `SEND_TO_PRESIDENT` | BACK_SEC → PRES_APPROVAL | COUNCIL_SECRETARY |
| `PRESIDENT_APPROVE` | PRES_APPROVAL → SCHEDULED | COUNCIL_PRESIDENT |
| `PRESIDENT_RETURN` | PRES_APPROVAL → BACK_SEC | COUNCIL_PRESIDENT |
| `HOLD` | SCHEDULED → HELD | COUNCIL_SECRETARY |
| `ADJOURN` | SCHEDULED → ADJOURNED | COUNCIL_SECRETARY |
| `CANCEL` | SCHEDULED → CANCELLED | COUNCIL_SECRETARY |

---

#### `POST /api/v1/meetings/:id/topics/:topicId/withdraw` — سحب موضوع

**الصلاحية:** `COUNCIL_SECRETARY`

**الأثر:** الموضوع يعود إلى `IN_AGENDA_BOX`

---

#### `PATCH /api/v1/meetings/:id/topics/:topicId/defer` — تأجيل داخل الجلسة

**الصلاحية:** `COUNCIL_PRESIDENT`

**الأثر:** `slotStatus → DEFERRED`، الموضوع يعود إلى `IN_AGENDA_BOX`

---

## 8. تصميم API — المحضر والقرار والتبليغ

### 8.1 المحاضر (Minutes)

#### `POST /api/v1/meetings/:meetingId/minutes` — إنشاء محضر

**الصلاحية:** `COUNCIL_SECRETARY`

**الطلب:**
```json
{
  "body": "نص المحضر..."
}
```

---

#### `PATCH /api/v1/minutes/:id` — تعديل المحضر

**الصلاحية:** `COUNCIL_SECRETARY` — فقط في `MIN_DRAFT` أو `MIN_GS_RETURNED`

---

#### `POST /api/v1/minutes/:id/transition` — انتقال حالة المحضر

**قيم `action`:**

| `action` | من → إلى | الصلاحية |
|----------|----------|----------|
| `SEND_TO_GS` | DRAFT → GS_REVIEW | COUNCIL_SECRETARY |
| `GS_APPROVE` | GS_REVIEW → MEMBERS_CONSULT | GENERAL_SECRETARY |
| `GS_RETURN` | GS_REVIEW → GS_RETURNED | GENERAL_SECRETARY |
| `RESUBMIT_TO_GS` | GS_RETURNED → GS_REVIEW | COUNCIL_SECRETARY |
| `CLOSE_FEEDBACK` | MEMBERS_CONSULT → TO_PRESIDENT | COUNCIL_SECRETARY |
| `SIGN` | TO_PRESIDENT → SIGNED | COUNCIL_PRESIDENT |
| `REJECT_SIGN` | TO_PRESIDENT → PRES_REJECT | COUNCIL_PRESIDENT |
| `GS_REWORK` | PRES_REJECT → GS_REVIEW | GENERAL_SECRETARY |

**عند `CLOSE_FEEDBACK`:**
- يدوي: أمين المجلس يغلق المرحلة
- آلي: بعد انتهاء `feedbackDeadline` (مهمة مجدولة — Cron)

---

#### `POST /api/v1/minutes/:id/feedback` — إبداء مرئية

**الصلاحية:** `COUNCIL_MEMBER` — فقط في `MIN_MEMBERS_CONSULT`

**الطلب:**
```json
{
  "comment": "نص المرئية"
}
```

---

### 8.2 القرارات (Decisions)

#### `POST /api/v1/minutes/:minutesId/decisions` — إنشاء مسودة قرار

**الصلاحية:** `COUNCIL_PRESIDENT` أو `COUNCIL_SECRETARY` — بعد `MIN_SIGNED`

**الطلب:**
```json
{
  "topicId": "...",
  "summary": "نص القرار"
}
```

---

#### `POST /api/v1/decisions/:id/issue` — إصدار القرار

**الصلاحية:** `COUNCIL_PRESIDENT` فقط

**الأثر:**
1. `decision.status → DEC_ISSUED`
2. `decision.issuedAt → now()`
3. إنشاء `Notification` تلقائي من نوع `DECISION_NOTIFICATION` للإدارة الطالبة
4. الموضوع يتحول إلى `DECISION_ISSUED`

---

### 8.3 التبليغات (Notifications)

#### `GET /api/v1/notifications` — إشعاراتي

**الصلاحية:** أي مستخدم مسجّل — يرى إشعاراته فقط

**المعاملات:** `status`, `type`, `page`, `limit`

---

#### `POST /api/v1/notifications/:id/deliver` — تنفيذ التبليغ

**الصلاحية:** `GENERAL_SECRETARY`

**الأثر:**
- `NOTIF_PENDING → NOTIF_DONE`
- إنشاء `NotificationDeliveryAttempt` بنتيجة `SUCCESS`
- إشعار مدير الإدارة الطالبة

---

#### `POST /api/v1/notifications/:id/manual-resolve` — تسوية يدوية

**الصلاحية:** `GENERAL_SECRETARY` أو `SYSTEM_ADMIN`

**الطلب:**
```json
{
  "reason": "تم التبليغ هاتفياً"
}
```

---

#### آلية إعادة المحاولة (Retry Mechanism)

تُنفَّذ عبر **Cron Job** داخل NestJS (`@nestjs/schedule`):

```typescript
// يعمل كل 5 دقائق
@Cron('*/5 * * * *')
async retryFailedNotifications() {
  // 1. جلب الإشعارات بحالة NOTIF_FAIL و nextRetryAt <= now
  // 2. لكل إشعار: retryCount < NOTIF_RETRY_MAX
  // 3. محاولة التسليم
  // 4. عند النجاح: NOTIF_DONE
  // 5. عند الفشل: retryCount++, nextRetryAt = now + NOTIF_RETRY_INTERVAL_MINUTES
  // 6. عند استنفاد المحاولات: إنشاء تنبيه للأمين العام
}
```

---

## 9. المصادقة والتفويض

### 9.1 استراتيجية المصادقة (MVP)

**النمط:** JWT (JSON Web Tokens) مع مصادقة محلية بكلمة مرور

```
┌──────────┐     POST /auth/login      ┌──────────┐
│ المتصفح  │ ────────────────────────► │ الخادم   │
│          │ ◄──── { accessToken,      │          │
│          │        refreshToken }     │          │
│          │                           │          │
│          │     GET /api/v1/topics    │          │
│          │     Authorization: Bearer │          │
│          │ ────────────────────────► │          │
└──────────┘                           └──────────┘
```

#### `POST /api/v1/auth/login` — تسجيل الدخول

**الطلب:**
```json
{
  "email": "ahmed@company.sa",
  "password": "********"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "...",
      "displayName": "أحمد محمد",
      "roles": [
        { "code": "DEPT_STAFF", "councilId": null, "councilName": null }
      ]
    }
  }
}
```

**تفاصيل JWT:**
- `accessToken`: صلاحية **15 دقيقة**
- `refreshToken`: صلاحية **7 أيام**
- Payload: `{ sub: userId, roles: [...], clearanceLevel: sortOrder }`

#### `POST /api/v1/auth/refresh` — تجديد التوكن

#### `POST /api/v1/auth/logout` — تسجيل الخروج (إلغاء refreshToken)

### 9.2 Guards (حماة الصلاحيات)

```typescript
// 1. JwtAuthGuard — يتحقق من صحة التوكن
@UseGuards(JwtAuthGuard)

// 2. RolesGuard — يتحقق من الدور المطلوب
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('GENERAL_SECRETARY')

// 3. ClearanceGuard — يتحقق من مستوى السرية
@UseGuards(JwtAuthGuard, RolesGuard, ClearanceGuard)
```

### 9.3 منطق التفويض في RolesGuard

```typescript
// الخطوات:
// 1. جلب أدوار المستخدم من UserRole
// 2. التحقق من مطابقة الدور المطلوب
// 3. إذا لم يُطابق: البحث في Delegation النشطة
//    - state = 'ACTIVE'
//    - validFrom <= now <= validUntil
//    - scopeType يغطي العملية المطلوبة
// 4. إذا وُجد تفويض صالح: السماح + تسجيل delegationId في الطلب
```

### 9.4 Decorators مخصصة

```typescript
// استخراج المستخدم الحالي
@CurrentUser() user: AuthenticatedUser

// تحديد الأدوار المطلوبة
@Roles('COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT')

// تحديد أن الـ endpoint يتطلب مطابقة السرية
@RequireClearance()

// تحديد أن التفويض مسموح لهذا الـ endpoint
@AllowDelegation()
```

---

## 10. الأمان والسرية

### 10.1 فلترة السرية

**التنفيذ:** Prisma Middleware أو Extension يُضيف شرط السرية تلقائياً:

```typescript
// في PrismaService أو كـ Middleware
prisma.$use(async (params, next) => {
  if (['Topic', 'Meeting', 'Minutes', 'Decision'].includes(params.model)) {
    // إضافة شرط: secrecyLevel.sortOrder <= user.maxClearance.sortOrder
    // أو منع الوصول إذا كان الموضوع أعلى سرية
  }
  return next(params);
});
```

### 10.2 العزل الظاهري (PRD §13)

**التنفيذ:** `VisibilityInterceptor` على كل endpoint يُرجع بيانات تخص مسار المجلس.

```typescript
@Injectable()
export class VisibilityInterceptor implements NestInterceptor {
  intercept(context, next) {
    return next.handle().pipe(
      map(data => {
        const user = context.switchToHttp().getRequest().user;
        if (this.isCouncilPresident(user)) {
          return this.applyPresidentIsolation(data);
        }
        return data;
      })
    );
  }

  private applyPresidentIsolation(data) {
    // استبدال actorActualId بـ actorDisplayId
    // إخفاء أي إشارة للأمين العام
    // إظهار "أمانة المجلس" كمصدر
  }
}
```

### 10.3 قواعد أمان إضافية

| القاعدة | التنفيذ |
|---------|---------|
| HTTPS | إعداد في reverse proxy (nginx) |
| Rate Limiting | `@nestjs/throttler` — 100 طلب/دقيقة/مستخدم |
| Input Validation | `class-validator` + `ValidationPipe` عالمي |
| SQL Injection | محمي عبر Prisma (parameterized queries) |
| XSS | تعقيم المدخلات النصية، React يهرب تلقائياً |
| CORS | محدد بـ `FRONTEND_ORIGIN` فقط |
| File Upload | تحقق من نوع الملف + حد الحجم |
| Audit Immutability | لا endpoint حذف لـ AuditLog؛ soft delete فقط لبقية الكيانات |

---

## 11. وصف الشاشات وتدفق الواجهة

### 11.1 خريطة الشاشات حسب الدور

```
تسجيل الدخول ──► [حسب الدور]
│
├── موظف إداري مختص
│   ├── لوحة المعلومات (مواضيعي)
│   ├── إنشاء موضوع جديد
│   ├── تعديل المسودة + رفع المرفقات
│   ├── قائمة مواضيع إدارتي
│   └── تفاصيل الموضوع (قراءة فقط بعد الإرسال)
│
├── مدير الإدارة
│   ├── لوحة المعلومات (مواضيع بانتظار الاعتماد)
│   ├── قائمة مواضيع إدارتي
│   ├── تفاصيل الموضوع + اعتماد/إعادة
│   ├── استلام التبليغات بالقرارات
│   └── إغلاق/أرشفة مواضيع مُعادة
│
├── الأمين العام
│   ├── لوحة المعلومات (شاملة — جميع المجالس)
│   ├── الوارد العام (مواضيع جديدة)
│   ├── تفاصيل الموضوع + قبول/تعليق/رفض/إعادة
│   ├── المواضيع المعلّقة
│   ├── موافقة مسودات الاجتماعات
│   ├── مراجعة المحاضر + موافقة/إرجاع
│   ├── تنفيذ التبليغات
│   ├── سجل التدقيق الكامل
│   └── إدارة التفويضات
│
├── أمين المجلس
│   ├── لوحة المعلومات (مجلسي)
│   ├── المواضيع الواردة لأمانة المجلس
│   ├── إسناد الفحص
│   ├── صندوق الأجندة + إعادة الترتيب
│   ├── إنشاء اجتماع + ربط المواضيع
│   ├── إعداد المحضر + توزيع المرئيات
│   └── إدارة التفويضات
│
├── موظف فحص
│   ├── المواضيع المُسندة لي
│   └── تسجيل نتيجة الفحص
│
├── رئيس المجلس
│   ├── لوحة المعلومات (مجلسي — معزولة)
│   ├── المواضيع بعد الفحص (مناسب/إعادة)
│   ├── الموافقة على الاجتماعات
│   ├── توقيع المحاضر + إصدار القرارات
│   └── [العزل الظاهري مُطبّق — لا يظهر الأمين العام]
│
├── عضو مجلس
│   ├── الاجتماعات القادمة
│   └── المحاضر المتاحة للمرئيات
│
└── مدير النظام
    ├── لوحة المعلومات (النظام)
    ├── إدارة المستخدمين والأدوار
    ├── إدارة الوحدات التنظيمية
    ├── إدارة المجالس
    ├── مستويات السرية
    ├── معلمات التهيئة
    ├── سجلات التدقيق (حسب الشاشة/الوحدة)
    └── التدخل الاستثنائي في المسارات
```

### 11.2 وصف الشاشات الرئيسية

#### شاشة تسجيل الدخول
- حقل البريد الإلكتروني + كلمة المرور
- زر «دخول»
- رسائل خطأ واضحة بالعربي
- لا يوجد تسجيل ذاتي (المستخدمون يُنشأون من مدير النظام)

#### الهيكل العام (Layout)
```
┌───────────────────────────────────────────────┐
│  الشعار    نظام إدارة المجالس    [الاسم ▼]   │  ← Header
├────────────┬──────────────────────────────────┤
│            │                                  │
│  القائمة   │        المحتوى الرئيسي           │
│  الجانبية  │                                  │
│  (حسب      │   ┌──────────────────────┐       │
│   الدور)   │   │    Breadcrumbs       │       │
│            │   ├──────────────────────┤       │
│  ─ لوحة   │   │                      │       │
│  ─ المواضيع│   │    محتوى الشاشة     │       │
│  ─ الوارد  │   │                      │       │
│  ─ ...     │   │                      │       │
│            │   └──────────────────────┘       │
│            │                                  │
├────────────┴──────────────────────────────────┤
│  [🔔 إشعارات جديدة: 3]                        │  ← شريط الإشعارات
└───────────────────────────────────────────────┘
```

- **الاتجاه:** RTL بالكامل — القائمة الجانبية على **اليمين**
- **مكتبة المكونات:** Ant Design مع تهيئة `direction="rtl"` و `locale={arEG}`

#### شاشة إنشاء موضوع
- نموذج يتضمن: العنوان، المجلس المستهدف (قائمة منسدلة)، درجة السرية (قائمة منسدلة)
- منطقة رفع المرفقات (سحب وإسقاط + زر اختيار)
- عداد المرفقات مع إظهار الحد الأدنى المطلوب
- أزرار: «حفظ كمسودة» / «إرسال للاعتماد»

#### شاشة تفاصيل الموضوع
- بيانات الموضوع الأساسية (عنوان، رقم مرجعي، مجلس، سرية)
- قائمة المرفقات مع إمكانية التحميل
- **خط زمني (Timeline)** لسجل انتقالات الحالة
- **أزرار الإجراءات** تظهر فقط حسب الصلاحية والحالة الحالية
- **نموذج السبب** يظهر عند الرفض/الإعادة/التعليق

#### شاشة الوارد (الأمين العام)
- جدول بالمواضيع الواردة مع أعمدة: الرقم، العنوان، الإدارة، المجلس، السرية، التاريخ
- فلاتر: المجلس، الحالة، الفترة
- نقر على الصف يفتح تفاصيل الموضوع

#### شاشة صندوق الأجندة
- جدول قابل لإعادة الترتيب بالسحب والإسقاط (Drag & Drop)
- عمود ترتيب الدخول (FIFO)
- إمكانية تحديد عدة مواضيع لربطها باجتماع

#### شاشة التدقيق (مدير النظام)
- تصفية حسب: الكيان، المستخدم، الفترة، نوع الإجراء
- عرض القيم قبل/بعد كـ JSON diff
- لا يوجد زر حذف

---

## 12. الإشعارات والتنبيهات

### 12.1 أنواع الإشعارات

| النوع | المُستلم | المُحفِّز | الأولوية |
|-------|----------|-----------|----------|
| `TOPIC_PENDING_APPROVAL` | مدير الإدارة | موظف أرسل مسودة للاعتماد | عادي |
| `TOPIC_RETURNED` | موظف إداري / مدير الإدارة | إعادة من أي جهة | عالي |
| `TOPIC_RECEIVED_GS` | الأمين العام | موضوع جديد في الوارد | عادي |
| `TOPIC_ACCEPTED` | أمين المجلس | قبول من الأمين العام | عادي |
| `EXAM_ASSIGNED` | موظف الفحص | إسناد فحص جديد | عادي |
| `EXAM_COMPLETE` | أمين المجلس | فحص مكتمل | عادي |
| `PRESIDENT_ACTION_NEEDED` | رئيس المجلس | موضوع/اجتماع/محضر بانتظاره | عالي |
| `MEETING_GS_APPROVAL` | الأمين العام | مسودة اجتماع بانتظار الموافقة | عادي |
| `MINUTES_FEEDBACK_REQUEST` | أعضاء المجلس | محضر مُتاح للمرئيات | عادي |
| `MINUTES_FEEDBACK_DEADLINE` | أعضاء المجلس | اقتراب انتهاء مهلة المرئيات | عالي |
| `DECISION_NOTIFICATION` | مدير الإدارة | تبليغ بقرار | حرج |
| `NOTIF_DELIVERY_FAILED` | الأمين العام | فشل تسليم تبليغ | حرج |
| `ADMIN_INTERVENTION` | الجهات المعنية (اختياري) | تدخل مدير النظام | عالي |

### 12.2 التنفيذ

- **v1:** إشعارات داخل النظام فقط (PRD §10.4)
- **التخزين:** جدول `Notification`
- **العرض:** أيقونة جرس في الـ Header مع عدّاد + قائمة منسدلة + شاشة كاملة
- **القراءة:** `PATCH /api/v1/notifications/:id/read` يُحدّث `readAt`
- **Polling:** React Query مع `refetchInterval: 30_000` (30 ثانية)
- **مستقبلاً:** WebSocket أو Server-Sent Events لإشعارات فورية

---

## 13. لوحة المعلومات والتقارير

### 13.1 مؤشرات الأداء (PRD §1.4)

#### `GET /api/v1/dashboard/stats`

**الصلاحية:** `GENERAL_SECRETARY` (كل المجالس) أو `COUNCIL_SECRETARY` (مجلسه)

**المعاملات:**

| المعامل | النوع | وصف |
|---------|-------|------|
| `councilId` | `string` | اختياري — تصفية مجلس محدد |
| `fromDate` | `ISO date` | بداية الفترة (إلزامي) |
| `toDate` | `ISO date` | نهاية الفترة (إلزامي) |
| `status` | `string` | اختياري — تصفية حالة |

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "topicsCount": 45,
    "meetingsCount": 12,
    "decisionsCount": 30,
    "returnsCount": 8,
    "departmentsBreakdown": [
      { "orgId": "...", "orgName": "إدارة تقنية المعلومات", "count": 15 },
      { "orgId": "...", "orgName": "الإدارة المالية", "count": 10 }
    ],
    "statusBreakdown": [
      { "status": "DRAFT", "count": 5 },
      { "status": "IN_AGENDA_BOX", "count": 12 }
    ],
    "councilBreakdown": [
      { "councilId": "...", "councilName": "مجلس التقنية", "topics": 20, "decisions": 15 }
    ]
  }
}
```

### 13.2 مكونات لوحة المعلومات في الواجهة

| المكون | النوع | البيانات |
|--------|-------|----------|
| بطاقات ملخصة (Cards) | أرقام كبيرة | عدد المواضيع، الاجتماعات، القرارات، الإعادات |
| رسم بياني شريطي | Bar Chart | توزيع المواضيع حسب المجلس |
| رسم دائري | Pie Chart | توزيع حالات المواضيع |
| جدول الإدارات | Table | الإدارات مع عدد المواضيع لكل منها |
| فلتر الفترة | DateRangePicker | من تاريخ — إلى تاريخ (إلزامي) |
| فلتر المجلس | Select | اختيار المجلس |

**مكتبة الرسوم:** `@ant-design/charts` أو `recharts`

---

## 14. معلمات التهيئة

### 14.1 القيم الافتراضية (PRD §14)

| المفتاح | القيمة | النوع | الوصف |
|---------|--------|-------|-------|
| `MIN_ATTACHMENTS_COUNT` | `1` | INT | الحد الأدنى لعدد المرفقات لكل موضوع |
| `MAX_ATTACHMENT_SIZE_MB` | `10` | INT | الحد الأقصى لحجم الملف الواحد بالميغابايت |
| `ALLOWED_FILE_TYPES` | `pdf,doc,docx,xls,xlsx,png,jpg,jpeg` | STRING | أنواع الملفات المسموحة |
| `MEMBER_FEEDBACK_CLOSE_DAYS` | `5` | INT | مهلة إغلاق مرئيات الأعضاء (أيام عمل) |
| `NOTIF_RETRY_MAX` | `3` | INT | عدد محاولات إعادة التبليغ |
| `NOTIF_RETRY_INTERVAL_MINUTES` | `15` | INT | الفاصل بين محاولات التبليغ (دقائق) |
| `DELEGATION_MAX_DAYS` | `90` | INT | أقصى مدة تفويض (أيام) |
| `AUDIT_RETENTION_YEARS` | `7` | INT | مدة الاحتفاظ بسجلات التدقيق (سنوات) |
| `AGENDA_ORDER_DEFAULT` | `FIFO` | STRING | ترتيب صندوق الأجندة الافتراضي |
| `JWT_ACCESS_EXPIRY_MINUTES` | `15` | INT | صلاحية access token |
| `JWT_REFRESH_EXPIRY_DAYS` | `7` | INT | صلاحية refresh token |
| `RATE_LIMIT_PER_MINUTE` | `100` | INT | حد الطلبات لكل مستخدم في الدقيقة |

### 14.2 واجهة إدارة التهيئة

#### `GET /api/v1/admin/config` — قراءة جميع المعلمات

**الصلاحية:** `SYSTEM_ADMIN`

#### `PATCH /api/v1/admin/config/:key` — تعديل معلمة

**الصلاحية:** `SYSTEM_ADMIN`

**الطلب:**
```json
{
  "value": "5",
  "reason": "تغيير مهلة المرئيات إلى 5 أيام"
}
```

**الأثر:** يُنشئ `AuditLog` مع القيمة قبل/بعد.

---

## 15. خطة الاختبار ومعايير القبول

### 15.1 أنواع الاختبارات

| النوع | الأداة | النطاق | التغطية المستهدفة |
|-------|--------|--------|-------------------|
| **وحدة (Unit)** | Jest | Services, Guards, Pipes | > 80% |
| **تكامل (Integration)** | Jest + Supertest | Controllers + Database | جميع الـ endpoints |
| **E2E** | Playwright أو Cypress | الواجهة الكاملة | المسارات الرئيسية |

### 15.2 سيناريوهات القبول (Acceptance Criteria)

#### المسار الرئيسي — رحلة الموضوع الكاملة
```
1. ✅ موظف إداري ينشئ مسودة موضوع مع مرفق
2. ✅ يرسلها لمدير الإدارة
3. ✅ مدير الإدارة يعتمد ويرسل للأمانة العامة
4. ✅ الأمين العام يقبل ويحول للمجلس
5. ✅ أمين المجلس يسند الفحص
6. ✅ موظف الفحص يسجل النتيجة (مكتمل)
7. ✅ أمين المجلس يعرض على الرئيس
8. ✅ رئيس المجلس يوافق (مناسب → صندوق الأجندة)
9. ✅ أمين المجلس ينشئ اجتماع ويربط الموضوع
10. ✅ مسار الموافقة: أمين عام → أمين مجلس → رئيس
11. ✅ أمين المجلس يعد المحضر
12. ✅ مسار المحضر: أمين عام → أعضاء (مرئيات) → رئيس (توقيع)
13. ✅ رئيس المجلس يصدر القرار
14. ✅ الأمين العام يبلّغ الإدارة الطالبة
15. ✅ مدير الإدارة يستلم إشعار التبليغ
```

#### سيناريوهات الرفض والإعادة
```
1. ✅ مدير الإدارة يعيد المسودة للتعديل — الموظف يرى الموضوع في DRAFT مع السبب
2. ✅ الأمين العام يرفض — الموضوع يعود للإدارة مع السبب
3. ✅ الأمين العام يعيد لمجلس غير مناسب — الإدارة تعدّل وتعيد الإرسال
4. ✅ الفحص غير مكتمل — دورة تصحيح ثم إعادة فحص
5. ✅ رئيس المجلس يعيد (فحص كامل) — يعود لخطوة الفحص
6. ✅ رئيس المجلس يعيد (تصحيح مسار) — يعود بدون فحص كامل
7. ✅ رفض توقيع المحضر — يعود للأمين العام ثم يستمر المسار
8. ✅ تعليق موضوع ثم استئنافه
```

#### سيناريوهات العزل الظاهري
```
1. ✅ الأمين العام يوافق على محضر — رئيس المجلس يرى الموافقة من "أمانة المجلس"
2. ✅ سجل التدقيق يُظهر الفاعل الفعلي للأمين العام ومدير النظام
3. ✅ إشعارات رئيس المجلس لا تحتوي على اسم الأمين العام
```

#### سيناريوهات السرية
```
1. ✅ مستخدم بمستوى "داخلي" لا يرى مواضيع "سري"
2. ✅ محاولة الوصول المباشر عبر URL تُرفض وتُسجل في التدقيق
3. ✅ فلترة تلقائية في القوائم والبحث
```

#### سيناريوهات التفويض
```
1. ✅ تفويض أمين عام لمساعد — المساعد يستطيع القبول/الرفض
2. ✅ انتهاء التفويض — المُفوّض يفقد الصلاحية فوراً
3. ✅ لا تفويضان نشطان لنفس العملية
4. ✅ سجل التدقيق يُظهر المُفوَّض + مرجع التفويض
```

#### سيناريوهات التبليغ
```
1. ✅ تبليغ ناجح — NOTIF_DONE + إشعار لمدير الإدارة
2. ✅ فشل تبليغ — 3 محاولات آلية ثم تنبيه للأمين العام
3. ✅ تسوية يدوية — الأمين العام يُؤكد التبليغ مع سبب
```

### 15.3 هيكل ملفات الاختبار

```
backend/
├── test/
│   ├── e2e/
│   │   └── topic-lifecycle.e2e-spec.ts
│   └── jest-e2e.json
└── src/
    ├── topics/
    │   ├── topics.service.spec.ts
    │   ├── topics-workflow.service.spec.ts
    │   └── topics.controller.spec.ts
    ├── auth/
    │   ├── auth.service.spec.ts
    │   └── guards/
    │       ├── roles.guard.spec.ts
    │       └── clearance.guard.spec.ts
    └── ...
```

---

## 16. النشر والبنية التحتية

### 16.1 البيئات

| البيئة | قاعدة البيانات | الغرض |
|--------|----------------|-------|
| **تطوير محلي** | SQLite (`file:./dev.db`) | تطوير سريع بدون Docker |
| **تطوير مشترك** | PostgreSQL (Docker Compose) | اختبار تكامل الفريق |
| **اختبار (Staging)** | PostgreSQL | اختبار قبول المستخدم (UAT) |
| **إنتاج** | PostgreSQL (مُدار) | الخدمة الفعلية |

### 16.2 Docker Compose (تطوير)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: councils
      POSTGRES_PASSWORD: councils_dev
      POSTGRES_DB: councils
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://councils:councils_dev@db:5432/councils
      FRONTEND_ORIGIN: http://localhost:5173
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"

volumes:
  pgdata:
```

### 16.3 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
steps:
  - Backend lint + type-check
  - Backend unit tests
  - Backend integration tests (SQLite)
  - Frontend lint + type-check
  - Frontend build
  - (Staging) Prisma migrate deploy
  - (Staging) Deploy
```

### 16.4 متطلبات الخادم (إنتاج MVP)

| المكون | المواصفات المقترحة |
|--------|-------------------|
| التطبيق | 2 vCPU، 4 GB RAM |
| قاعدة البيانات | 2 vCPU، 4 GB RAM، 50 GB SSD |
| التخزين (مرفقات) | 100 GB (قابل للتوسعة) |
| النسخ الاحتياطي | يومي، RPO ≤ 24 ساعة |

---

## 17. سيناريوهات حافة ومعالجة الأخطاء

### 17.1 سيناريوهات حافة

| السيناريو | المعالجة |
|-----------|---------|
| **حذف/تعطيل مستخدم له مواضيع نشطة** | المواضيع تبقى كما هي؛ المستخدم يُعطّل (`isActive=false`)؛ لا يستطيع تسجيل الدخول؛ مدير النظام يُعيد إسناد المواضيع أو يتدخل |
| **انتهاء تفويض أثناء معالجة موضوع** | الإجراء المُنفّذ فعلياً قبل الانتهاء يبقى صالحاً؛ أي إجراء بعد الانتهاء يُرفض مع رسالة خطأ واضحة |
| **تغيير مستوى سرية مستخدم** | يُطبّق فوراً؛ المواضيع المفتوحة الأعلى سرية تختفي من قوائمه؛ لا يُلغى ما نُفّذ سابقاً |
| **تعديلان متزامنان على نفس الموضوع** | Optimistic Locking عبر حقل `updatedAt`؛ الطلب الثاني يحصل على `409 Conflict` |
| **حذف مجلس أو إدارة** | Soft delete فقط؛ لا يُحذف فعلياً بسبب ارتباطات المواضيع والقرارات |
| **موضوع في صندوق الأجندة مربوط باجتماع مُلغى** | يعود تلقائياً لصندوق الأجندة (PRD §9.8.5) |
| **رفع ملف بامتداد غير مسموح** | رفض فوري مع رسالة خطأ + عدم حفظ الملف |
| **تجاوز حد حجم الملف** | رفض فوري قبل الحفظ |
| **فقدان الاتصال أثناء رفع مرفق** | الملفات الجزئية لا تُربط بالموضوع؛ تُنظف دورياً (Cron) |
| **محاولة إنشاء اجتماع بدون مواضيع** | مسموح (المواضيع تُربط لاحقاً قبل الإرسال للأمين العام) |
| **مرئية عضو بعد إغلاق المهلة** | تُرفض مع رسالة «انتهت مهلة المرئيات» |

### 17.2 رسائل الخطأ المعيارية

| الكود | الرسالة | HTTP Status |
|-------|---------|-------------|
| `AUTH_INVALID_CREDENTIALS` | بيانات الدخول غير صحيحة | 401 |
| `AUTH_TOKEN_EXPIRED` | انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً | 401 |
| `AUTHZ_INSUFFICIENT_ROLE` | لا تملك صلاحية تنفيذ هذا الإجراء | 403 |
| `AUTHZ_CLEARANCE_DENIED` | مستوى السرية لا يسمح بالوصول | 403 |
| `TOPIC_INVALID_TRANSITION` | لا يمكن تنفيذ هذا الإجراء في الحالة الحالية | 422 |
| `TOPIC_MIN_ATTACHMENTS` | يجب إرفاق {n} ملف/ملفات على الأقل | 422 |
| `DELEGATION_EXPIRED` | التفويض منتهي الصلاحية | 403 |
| `DELEGATION_CONFLICT` | يوجد تفويض نشط بنفس النطاق | 409 |
| `CONCURRENT_MODIFICATION` | تم تعديل البيانات من مستخدم آخر، يرجى تحديث الصفحة | 409 |
| `FILE_TYPE_NOT_ALLOWED` | نوع الملف غير مسموح | 422 |
| `FILE_SIZE_EXCEEDED` | حجم الملف يتجاوز الحد المسموح ({n} ميغابايت) | 422 |
| `NOTIF_RETRY_EXHAUSTED` | استُنفدت محاولات التبليغ | 500 |
| `ENTITY_NOT_FOUND` | العنصر المطلوب غير موجود | 404 |

### 17.3 Optimistic Locking

```typescript
// عند التعديل:
async updateTopic(id: string, dto: UpdateTopicDto, expectedUpdatedAt: Date) {
  const result = await prisma.topic.updateMany({
    where: {
      id,
      updatedAt: expectedUpdatedAt,  // يفشل إذا تغيّر
    },
    data: dto,
  });

  if (result.count === 0) {
    throw new ConflictException('CONCURRENT_MODIFICATION');
  }
}
```

---

## ملحق أ — البيانات الأولية (Seed Data)

### الأدوار
```typescript
const roles = [
  { code: 'DEPT_STAFF', labelAr: 'موظف إداري مختص' },
  { code: 'DEPT_MANAGER', labelAr: 'مدير الإدارة' },
  { code: 'GENERAL_SECRETARY', labelAr: 'الأمين العام' },
  { code: 'COUNCIL_SECRETARY', labelAr: 'أمين المجلس' },
  { code: 'EXAM_OFFICER', labelAr: 'موظف فحص' },
  { code: 'COUNCIL_PRESIDENT', labelAr: 'رئيس المجلس' },
  { code: 'COUNCIL_MEMBER', labelAr: 'عضو مجلس' },
  { code: 'SYSTEM_ADMIN', labelAr: 'مدير النظام' },
];
```

### المجالس
```typescript
const councils = [
  { code: 'HIRING', name: 'مجلس التوظيف' },
  { code: 'FINANCE', name: 'مجلس المالية' },
  { code: 'TECH', name: 'مجلس التقنية' },
  { code: 'OPS', name: 'مجلس التشغيل' },
  { code: 'MARKETING', name: 'مجلس التسويق' },
];
```

### مستويات السرية
```typescript
const secretLevels = [
  { name: 'عام', sortOrder: 1 },
  { name: 'داخلي', sortOrder: 2 },
  { name: 'سري', sortOrder: 3 },
  { name: 'سري للغاية', sortOrder: 4 },
];
```

### معلمات التهيئة
```typescript
const configs = [
  { key: 'MIN_ATTACHMENTS_COUNT', value: '1', valueType: 'INT' },
  { key: 'MAX_ATTACHMENT_SIZE_MB', value: '10', valueType: 'INT' },
  { key: 'ALLOWED_FILE_TYPES', value: 'pdf,doc,docx,xls,xlsx,png,jpg,jpeg', valueType: 'STRING' },
  { key: 'MEMBER_FEEDBACK_CLOSE_DAYS', value: '5', valueType: 'INT' },
  { key: 'NOTIF_RETRY_MAX', value: '3', valueType: 'INT' },
  { key: 'NOTIF_RETRY_INTERVAL_MINUTES', value: '15', valueType: 'INT' },
  { key: 'DELEGATION_MAX_DAYS', value: '90', valueType: 'INT' },
  { key: 'AUDIT_RETENTION_YEARS', value: '7', valueType: 'INT' },
  { key: 'AGENDA_ORDER_DEFAULT', value: 'FIFO', valueType: 'STRING' },
];
```

### مستخدم مدير النظام الافتراضي
```typescript
const adminUser = {
  email: 'admin@company.sa',
  passwordHash: bcrypt.hashSync('ChangeMe123!', 10),
  displayName: 'مدير النظام',
  // يُربط بدور SYSTEM_ADMIN
  // يُربط بأعلى مستوى سرية
};
```

---

## ملحق ب — مرجع سريع لحالات جميع الكيانات

| الكيان | الحالات |
|--------|---------|
| **الموضوع** | `DRAFT` · `PENDING_DEPT_MGR` · `APPROVED` · `SENT_TO_GS` · `INBOX_GS` · `GS_REVIEW` · `SUSPENDED` · `RETURNED_DEPT` · `CLOSED_BY_DEPT` · `WITH_COUNCIL` · `EXAM_IN_PROGRESS` · `EXAM_COMPLETE` · `EXAM_INCOMPLETE` · `PRESIDENT_REVIEW` · `RETURNED_COUNCIL` · `IN_AGENDA_BOX` · `LINKED_TO_MEETING` · `DEFERRED_IN_SESSION` · `DISCUSSED` · `DECISION_PENDING` · `DECISION_ISSUED` · `NOTIFIED` |
| **الاجتماع** | `MEETING_DRAFT_SEC` · `MEETING_GS_APPROVAL` · `MEETING_BACK_SEC` · `MEETING_PRES_APPROVAL` · `MEETING_SCHEDULED` · `MEETING_HELD` · `MEETING_ADJOURNED` · `MEETING_CANCELLED` |
| **المحضر** | `MIN_DRAFT` · `MIN_GS_REVIEW` · `MIN_GS_RETURNED` · `MIN_MEMBERS_CONSULT` · `MIN_TO_PRESIDENT` · `MIN_PRES_REJECT` · `MIN_SIGNED` |
| **القرار** | `DEC_DRAFT` · `DEC_ISSUED` |
| **التبليغ** | `NOTIF_PENDING` · `NOTIF_DONE` · `NOTIF_FAIL` |
| **التفويض** | `DELEGATION_DRAFT` · `PENDING_ACTIVATION` · `ACTIVE` · `SUSPENDED` · `EXPIRED` · `REVOKED` · `SUPERSEDED` |

---

## سجل التغييرات

| الإصدار | التاريخ | ملخص |
|---------|---------|------|
| 1.0 | 2026-04-10 | إنشاء أولي: بنية معمارية، نموذج بيانات، API كامل، شاشات، اختبارات |

---

*هذه الوثيقة مرجع تنفيذي مكمل لوثيقة المتطلبات PRD v1.0 — أي تغيير في المتطلبات ينعكس هنا بتحديث مقابل.*
