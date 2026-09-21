# Secure Trash and Device Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development and verification-before-completion while implementing this plan task-by-task.

**Goal:** إضافة سلة محذوفات قابلة للاستعادة وحذف نهائي مقيد بالمالك، مع صفحة تعرض الأجهزة والجلسات النشطة وتدعم إلغاء جلسة جهاز وتنبيه تسجيل الدخول الجديد.

**Architecture:** تبقى بيانات التطبيق الأساسية في سجل Workspace الحالي، بينما تُحفظ سجلات الحذف والأجهزة والأحداث الأمنية في جداول Supabase منفصلة ومحمية بسياسات RLS ودوال SQL بصلاحيات دقيقة. الواجهة المحلية تعرض الميزات السحابية عند تسجيل الدخول، وتفشل بأمان إلى رسالة إعداد واضحة دون تعطيل التشغيل المحلي.

**Tech Stack:** React 19, TypeScript, Vite, Supabase Auth/Postgres/RLS, Vitest, CSS RTL.

**Spec:** طلب المستخدم بتاريخ 2026-09-21: نظام حذف آمن وإدارة الجلسات والأجهزة.

## Global Constraints

- لا حذف مباشر للزبائن أو المنتجات أو العقود أو الدفعات من قاعدة البيانات المحلية عند استخدام السحابة؛ تُنشأ نسخة محذوفة قابلة للاستعادة أولًا.
- الحذف النهائي لا ينفذه إلا مالك Workspace وبعد تأكيد إضافي.
- لا تُسجل كلمات مرور أو رموز جلسات أو عناوين IP كاملة في السجلات.
- الموقع التقريبي يُعرض من timezone/language أو قيمة تقريبية يرسلها العميل، وليس موقعًا دقيقًا.
- كل دالة جديدة في طبقة المجال لها اختبار Vitest يثبت السلوك الأساسي وحالات الصلاحيات.
- لا تُضاف حركات جديدة بمدة تتجاوز 300ms، وتُحترم `prefers-reduced-motion`.

---

### Task 1: Domain contracts and failing tests

**Files:**
- Create: `src/domain/securityFeatures.ts`
- Create: `src/domain/securityFeatures.test.ts`
- Modify: `src/domain/types.ts`

**Interfaces:**
- `DeletedRecord`, `DeviceSession`, `SecurityEvent` types.
- Pure helpers: `entityLabel`, `canPermanentlyDelete`, `formatApproximateLocation`, `isNewSecurityEvent`.

- [ ] Write failing tests for owner-only permanent deletion, non-owner denial, location formatting, and ignoring the current login event.
- [ ] Run `npm test src/domain/securityFeatures.test.ts` and confirm expected missing-export failures.
- [ ] Add minimal types/helpers.
- [ ] Run the focused test and then the existing domain tests.

### Task 2: Safe-trash Supabase schema and client API

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/domain/cloudSync.ts`
- Modify: `src/domain/securityFeatures.ts`
- Test: `src/domain/securityFeatures.test.ts`

**Interfaces:**
- `listTrash()`, `restoreTrash(id)`, `trashRecord(entityType, entityId, payload, deletedBy)`, `permanentlyDeleteTrash(id)`.
- `listDeviceSessions()`, `registerCurrentDevice()`, `touchCurrentDevice()`, `revokeDevice(id)`, `listSecurityEvents()`, `markSecurityEventsRead(ids)`.

- [ ] Add RLS-protected tables for `aqsaty_trash`, `aqsaty_device_sessions`, and `aqsaty_security_events`.
- [ ] Add security-definer SQL functions enforcing Workspace membership and owner-only permanent deletion.
- [ ] Add typed Supabase calls with graceful disabled/offline behavior.
- [ ] Add client-side input validation and tests for returned normalized data.

### Task 3: Route all destructive local operations through trash

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/domain/store.ts`
- Test: `src/domain/securityFeatures.test.ts`

**Interfaces:**
- `trashLocalRecord(database, entityType, entityId, deletedBy)` returns a cloned database and a `DeletedRecord`.
- `restoreLocalRecord(database, deletedRecord)` restores the original entity without overwriting newer records.

- [ ] Write tests for local customer/product/contract deletion moving data to a trash list, retaining delete actor/time, and restoring safely.
- [ ] Run focused tests red.
- [ ] Implement local trash metadata and route customer/product/contract deletion through it; keep payments linked to deleted contracts in the trash payload.
- [ ] Add an extra confirmation phrase for contracts and require the owner PIN for final local deletion.
- [ ] Run focused tests green.

### Task 4: Trash management UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- New admin tab `trash` with restore and permanent-delete handlers.

- [ ] Add a trash tab showing entity, deleted-by, deleted-at, restore action, and owner-only permanent deletion.
- [ ] Add explicit confirmation phrase for permanent deletion.
- [ ] Add accessible alert, disabled/loading states, and keyboard-safe controls.
- [ ] Keep brand colors, use existing card/table patterns, and use sub-300ms transform/opacity transitions only.

### Task 5: Device sessions, login events, and notification UI

**Files:**
- Modify: `src/domain/cloudSync.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/domain/securityFeatures.test.ts`

**Interfaces:**
- Register/touch current device after cloud login and on app start.
- Device list includes last-used time, device/browser label, approximate location, current marker, and revoke action.
- New-login banner is shown for recent unread events and can be dismissed/marked read.

- [ ] Add tests for new-login event filtering and device label/location formatting.
- [ ] Implement a stable per-browser device ID stored in localStorage; never store auth tokens in the app database.
- [ ] Add session management section under a new admin tab or security settings page.
- [ ] Revoke selected devices via the protected RPC and sign out locally if the current device is revoked.
- [ ] Poll security events only while the admin panel is open, with a conservative interval and cleanup.

### Task 6: Documentation and operational notes

**Files:**
- Modify: `README.md`
- Modify: `docs/supabase-auth-plan.md`

- [ ] Document the SQL migration, required owner membership, approximate-location behavior, and limitation that revocation is enforced on app access unless a server-side Auth Admin integration is added.
- [ ] Document the security questions: which devices are active, which destructive operation occurred, and why a session was revoked.

### Task 7: Verification

- [ ] Run focused tests, all tests, `npm run check`, `npm run lint`, and `npm run build`.
- [ ] Run `git diff --check` and scan the diff for secrets/tokens.
- [ ] Run a local browser smoke test at 375px and 1280px for the admin tabs and confirm no console errors.
- [ ] Review changed animations against reduced-motion and duration constraints.
- [ ] Commit atomic increments with descriptive messages; do not push or merge without user request.

## Self-review

All requested capabilities map to Tasks 2–5: trash instead of direct deletion, restore, delete actor, extra confirmation, owner-only final deletion, connected-device list, last-used time, device type, approximate location, selected-device logout, and new-login notification. The plan intentionally documents the browser-only revocation limitation rather than claiming that a client-side app can revoke Supabase refresh tokens server-side.
