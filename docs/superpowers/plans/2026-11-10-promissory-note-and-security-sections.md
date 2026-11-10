# Promissory Note and Security Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** فصل سلة المحذوفات والضامنين إلى تبويبات مستقلة وإضافة خيار طباعة سند لأمر/كمبيالة اختياري من بطاقة العقد.

**Architecture:** ستبقى بيانات السلة والضامنين داخل Database كما هي، مع نقل عرضهما من تبويب النسخ والإعدادات إلى تبويبين مستقلين. سيُبنى السند من بيانات العقد دون تخزينه تلقائيًا، ويُطبع فقط بعد أن يراجع المستخدم الحقول ويؤكد أنها مكتملة. سيُوسم المستند بوضوح بأنه نموذج سند لأمر/كمبيالة قابل للمراجعة القانونية، لأن الصلاحية والتنفيذ يعتمدان على صحة الوقائع والتوقيع والإجراءات القضائية.

**Tech Stack:** React 19, TypeScript, Vitest, lucide-react, CSS print layout.

**Spec:** طلب المستخدم بتاريخ 2026-11-10، مع مراعاة قانون التجارة العراقي رقم 30 لسنة 1984 ومتطلبات البيانات الشكلية المتداولة للسند لأمر.

## Global Constraints

- لا يُحذف أي سجل من Database عند فصل العرض.
- سلة المحذوفات والضامنين يحتفظان بصلاحيات ومنطق الحذف/الاستعادة الحالي.
- السند اختياري ولا يُنشأ تلقائيًا عند إنشاء العقد.
- لا يُوصف السند بأنه ضمان قانوني مضمون أو استشارة قانونية.
- يجب أن يتضمن النموذج: عبارة سند لأمر، تعهد غير معلق على شرط، مبلغًا رقميًا وكتابيًا، تاريخ ومكان الإنشاء، تاريخ ومكان الاستحقاق، اسم المستفيد، اسم المحرر وعنوانه وتوقيعه، وبيان العقد المرتبط.

---

### Task 1: Domain model and tests for promissory note data

**Files:**
- Create: `src/domain/promissoryNote.ts`
- Create: `src/domain/promissoryNote.test.ts`

- [ ] Write failing tests for default amount/maturity and required-field validation.
- [ ] Implement pure draft builder and validator without browser dependencies.
- [ ] Verify the focused tests pass.

### Task 2: Separate security sections in AdminPanel

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] Extend the tab union with `trash` and `guarantors`.
- [ ] Add dedicated sidebar buttons with icons.
- [ ] Render `TrashPanel` and `GuarantorPanel` in their own tabs.
- [ ] Remove both panels from `backup`; retain encrypted backup, cloud auth, settings, and SecurityCenter there.

### Task 3: Optional promissory note print flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ContractCard.tsx`
- Modify: `src/styles.css`

- [ ] Add a print action to contract cards.
- [ ] Add a review modal with editable note amount, dates, place, beneficiary, maker, address, and legal notice.
- [ ] Validate required fields before invoking existing print flow.
- [ ] Add a print-only Iraqi Arabic form with signature and witness areas.

### Task 4: Verification and release

- [ ] Run focused promissory-note tests.
- [ ] Run all tests, typecheck, lint, build, and `git diff --check`.
- [ ] Review the printed form against the mandatory-field checklist.
- [ ] Commit, push, create PR, and deploy only after all checks pass.
