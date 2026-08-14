# Phase 2 — Organization/Company Consolidation Plan (Design Only)

**Status:** Planning artifact only. No code changed. No SQL executed. No implementation performed.
**Depends on:** `PHASE_2_ORGANIZATION_DEDUPLICATION_AUDIT.md` (read that first — this plan assumes its findings).
**Goal:** Make the existing `organizationService.js` (Workflow B: Partner/Direct Customer/Partner-Customer, correct hierarchy) the **single canonical provisioning engine**, by folding in the parts of `modules/platform/*` (Workflow A: Company Provisioning) that Workflow B is currently missing — first-admin creation, Traccar group creation, role assignment — **without** creating a second organization/company table, and **without** deleting anything yet.

---

## 1. Design Goals & Constraints

1. **One table, one schema.** `companies` stays exactly as-is (`organization_type`, `parent_company_id`, `status`, `settings`, `traccar_group_id`). The audit already confirmed the schema is sufficient — no new organization/company table.
2. **One creation entry point per business operation** — `createPartner()`, `createDirectCustomer()`, `createCustomerUnderPartner()` — each capable of doing everything Workflow A does today (admin + Traccar group), but with the admin step **optional**, since:
   - A platform admin might create a Partner shell today and invite its admin tomorrow.
   - The current SaaS forms (name + slug only) must keep working during rollout — first-admin fields are additive, not a hard requirement, in the first shipped version.
3. **Backward compatible API responses.** Existing consumers (`PartnersPage.jsx`, `DirectCustomersPage.jsx`, `PlatformCompaniesSection.jsx`) must not break mid-rollout. Every response field that exists today keeps existing; new fields are additive.
4. **No regression to Phase 2D.** `tenantResolverService.js`, `scopeValidationService.js`, `active_contexts`, and the 17 Phase 2D tests must remain green throughout — this plan does not touch context switching.
5. **Reversible in stages.** Each stage below should be independently revertible (see §9 Rollback Strategy) — this is a refactor of *creation code paths*, not a data migration, so risk is concentrated in code, not data.

---

## 2. What Must Be Preserved From Workflow A (Company Provisioning)

Extracted verbatim from `fuel-api/src/modules/platform/companiesService.js` — these five steps are the actual value of the old workflow and must survive the consolidation, unchanged in behavior:

| # | Step | Current location | Must become |
|---|---|---|---|
| 1 | Validate `company.name`/`company.slug` (slug regex `^[a-z0-9]+(-[a-z0-9]+)*$`) + `admin.name`/`admin.email`/`admin.password` (≥6 chars) | `companiesService.js: validateInput()` | Shared validator, reusable by all three canonical create functions when `admin` is supplied |
| 2 | Create a Traccar user for the admin: `POST /api/users` via `traccarServiceFetch`, `administrator: false`, `attributes: { isManager: true }` (never `administrator: true` — tenant-scoped, not platform-wide) | `companiesService.js: provisionCompany()` step 1 | Extracted into a shared helper, e.g. `provisionCompanyAdmin()` |
| 3 | `ensureCompanyTraccarGroup(company.id)` | `companiesService.js: provisionCompany()` step 3, `services/companyProvisioningService.js` | Called from the shared helper for **every** company created through the canonical service, admin or not — a Traccar group should exist regardless of whether an admin was invited yet |
| 4 | Create `numz_users` row for the admin + assign `company_admin` role (`Role.findOne({key:'company_admin', companyId:null})` → `UserRole.findOrCreate`) | `companiesService.js: provisionCompany()` steps 4–5 | Shared helper |
| 5 | Status lifecycle `provisioning` → `active`, one-time temporary-password handoff in the API response (never persisted in plaintext beyond that single response) | `companiesService.js`, `CreateCompanyDialog.jsx` result view | Preserved exactly; reused by any canonical create call that includes `admin` |

**Ordering rationale to preserve:** Traccar user created *first* (fail before writing anything to Postgres); Postgres-only steps after. Keep this "fail-fast, no distributed transaction" ordering — it's a deliberate, documented tradeoff in the existing code, not an oversight.

---

## 3. What Must Be Added From Workflow B (SaaS Partner/Customer)

| # | Concept | Current location | Add to canonical service |
|---|---|---|---|
| 1 | `organization_type` set **explicitly** (`'partner'` or `'customer'`) — never left at the Sequelize default | `organizationService.js` | Already correct in `organizationService.js`; Workflow A never sets this — must set it explicitly when folded in |
| 2 | `parent_company_id` set **explicitly** (`NULL` for Partner/Direct Customer, `<partnerId>` for a Partner's Customer) | `organizationService.js` | Same — already correct, must be preserved as the canonical companies get created |
| 3 | Hierarchy validation: a Customer's parent must be an existing company with `organization_type = 'partner'`; a Partner can never have a parent | `organizationService.js: createCustomerUnderPartner()` | Preserved as-is |
| 4 | Distinct list/query semantics: `listPartners()` (`organization_type='partner'`), `listDirectCustomers()` (`organization_type='customer' AND parent_company_id IS NULL`), `listPartnerCustomers(partnerId)` | `organizationService.js` | Preserved as-is — Workflow A has no equivalent concept at all |
| 5 | Slug uniqueness check across the whole `companies` table (not just within a type) | Both workflows already do this independently — must stay a single check, not duplicated | Preserved, single implementation |
| 6 | Context-switching compatibility (`canAccessCompany`, `switchActiveContext` from Phase 2D) — any company the canonical service creates must be immediately switchable/scoped correctly, which only works if `organization_type`/`parent_company_id` are set correctly at creation time | `tenantResolverService.js` (unchanged) | No new work — automatic once #1–#2 are respected |

---

## 4. Canonical Provisioning Engine — Target Design

### 4.1 New shared helper (backend)

**New file:** `fuel-api/src/services/organizationProvisioningService.js`

```js
// Pulled out of modules/platform/companiesService.js, made reusable.
// No behavior change from the existing Workflow A steps — same Traccar
// call, same isManager:true, same ensureCompanyTraccarGroup, same
// company_admin role assignment, same temp-password-once response shape.

export function validateAdminInput(admin) { /* same rules as companiesService.js validateInput()'s admin.* checks */ }

export async function provisionCompanyAdmin({ companyId, admin }) {
  // 1. validateAdminInput(admin)
  // 2. POST Traccar /api/users (administrator:false, attributes.isManager:true)
  // 3. createNumzUserForAdmin({ traccarUserId, email, companyId })
  // 4. Role.findOne({ key:'company_admin', companyId:null }) -> UserRole.findOrCreate
  // returns { traccarUserId, name, email, temporaryPassword }
}

export async function ensureTraccarGroupForCompany(companyId) {
  // thin wrapper around the existing services/companyProvisioningService.js:ensureCompanyTraccarGroup
}
```

### 4.2 `organizationService.js` — extended signatures

```js
// Existing signature, extended with an optional `admin` block.
// When admin is omitted: identical behavior to today (bare company row).
// When admin is supplied: also provisions a real, login-capable admin +
// Traccar group, exactly like the old Company Provisioning workflow.

export async function createPartner({ name, slug, traccarGroupId, admin }) { ... }
export async function createDirectCustomer({ name, slug, traccarGroupId, admin }) { ... }
export async function createCustomerUnderPartner({ partnerId, name, slug, traccarGroupId, admin }) { ... }

// New: allows inviting/provisioning an admin for a company that already
// exists without one (covers both future partial-creates and, later,
// backfilling any pre-existing headless SaaS-created companies).
export async function provisionAdminForExistingCompany(companyId, admin) { ... }
```

Internal sequence for `createPartner({..., admin})` (representative of all three):
```
1. validate slug uniqueness (existing check, unchanged)
2. Company.create({ ..., organizationType:'partner', parentCompanyId:null, status: admin ? 'provisioning' : 'active' })
3. ensureTraccarGroupForCompany(company.id)          [ALWAYS — new]
4. if (admin) {
     const provisioned = await provisionCompanyAdmin({ companyId: company.id, admin })
     await Company.update({ status: 'active' }, { where: { id: company.id } })
     return { ...toOrgDto(company), admin: provisioned }
   }
5. return toOrgDto(company)   // unchanged shape when no admin supplied
```

### 4.3 `modules/platform/companiesService.js` — becomes a thin delegator

Once §4.2 exists, `provisionCompany(req)` in the OLD service is rewritten to **call** `organizationService.createDirectCustomer({ name, slug, admin })` (Direct Customer, because that has always been its de-facto behavior — `organization_type` defaulted to `'customer'`, `parent_company_id` to `NULL`, which IS the Direct Customer shape). This:
- Removes the duplicate `Company.create()` call entirely.
- Makes `organization_type`/`parent_company_id` **explicit** for the first time on this path (fixing the "silently indistinguishable" issue from the audit) — with zero behavior change for existing callers, since Direct Customer IS what it was already producing.
- Keeps `listCompanies()` unchanged (still reads all `companies`, now correctly labeled) or optionally narrows to `listDirectCustomers()` — **decision needed**, see §10.

---

## 5. File-by-File Changes

### Backend — ADD

| File | Purpose |
|---|---|
| `fuel-api/src/services/organizationProvisioningService.js` | New shared helper: `validateAdminInput`, `provisionCompanyAdmin`, `ensureTraccarGroupForCompany` (extracted from `companiesService.js`, no behavior change) |
| `fuel-api/migrations/20260813_organization_provisioning_notes.sql` *(optional, see §6)* | Only if a DB-level `organization_type` CHECK constraint is added |
| `fuel-api/src/services/organizationProvisioningService.test.js` | Unit tests for the extracted helper in isolation |

### Backend — MODIFY

| File | Change |
|---|---|
| `fuel-api/src/services/organizationService.js` | Add optional `admin` param + `provisionAdminForExistingCompany()` to `createPartner`/`createDirectCustomer`/`createCustomerUnderPartner`; call `ensureTraccarGroupForCompany` unconditionally; call `provisionCompanyAdmin` when `admin` is present |
| `fuel-api/src/controllers/organizationController.js` | Pass `req.body.admin` through to the three create functions; new controller `provisionAdmin` for the new endpoint (§5, API changes) |
| `fuel-api/src/routes/organizations.js` | Add `POST /api/partners/:id/admin`, `POST /api/direct-customers/:id/admin`, `POST /api/partners/:partnerId/customers/:customerId/admin` (or one generic `POST /api/organizations/:id/admin` — **decision needed**, see §10) |
| `fuel-api/src/modules/platform/companiesService.js` | `provisionCompany()` rewritten to delegate to `organizationService.createDirectCustomer({..., admin})`; `listCompanies()` unchanged or narrowed (decision needed) |
| `fuel-api/src/modules/platform/companiesController.js` | No change if `companiesService.js`'s function signatures stay the same (thin delegation keeps the controller untouched) |
| `fuel-api/src/routes/organizations.test.js` | **Must** gain an `after()` cleanup hook (mirrors `tenantResolverService.test.js`'s pattern) — this is a standalone, low-risk fix that should ship *before* or *alongside* this work regardless, since it's the dominant source of DB pollution per the audit |

### Backend — KEEP AS-IS (no changes)

- `fuel-api/src/models/Company.js`, `fuel-api/src/models/index.js` — schema untouched.
- `fuel-api/src/modules/organization/*` (Workflow C, self-service) — untouched, non-competing.
- `fuel-api/src/services/tenantResolverService.js`, `scopeValidationService.js`, `middleware/authGates.js`, `active_contexts` — untouched, Phase 2D stays intact.
- `fuel-api/src/services/companyProvisioningService.js` (`ensureCompanyTraccarGroup`) — reused, not modified.

### Backend — DEFERRED (not modified in this phase, flagged in audit §12)

- `fuel-api/src/modules/platform/{routes,companiesController,companiesRepository}.js` — kept operating (via the thin delegation in §4.3), not removed. Actual retirement/redirect is a **separate, later decision** once the SaaS UI supports first-admin invites end-to-end (see §7 sequencing).

### Frontend — ADD

| File | Purpose |
|---|---|
| `traccar-fleet-system/frontend/src/saas/components/AdminInviteFields.jsx` | Shared, optional "First administrator" form section (name/email/phone/password + show/hide), extracted from `CreateCompanyDialog.jsx` so `PartnersPage.jsx`/`DirectCustomersPage.jsx` can reuse the exact same fields/validation instead of re-implementing them |
| `traccar-fleet-system/frontend/src/saas/components/AdminCredentialsResult.jsx` | Shared "credentials created — copy password now" result view, extracted from `CreateCompanyDialog.jsx`'s inline result state |

### Frontend — MODIFY

| File | Change |
|---|---|
| `traccar-fleet-system/frontend/src/saas/organizationApi.js` | `createPartner`/`createDirectCustomer`/`createPartnerCustomer` accept an optional `admin` field in their payload; add `provisionAdmin(user, orgId, admin)` calling the new endpoint |
| `traccar-fleet-system/frontend/src/saas/pages/PartnersPage.jsx` | Create-dialog gains an optional, collapsed-by-default "Add first administrator" section using `AdminInviteFields`; on success with `admin`, show `AdminCredentialsResult` |
| `traccar-fleet-system/frontend/src/saas/pages/DirectCustomersPage.jsx` | Same as above |
| `traccar-fleet-system/frontend/src/settings/center/components/CreateCompanyDialog.jsx` | Refactored to use the new shared `AdminInviteFields`/`AdminCredentialsResult` components (dedupes UI, no behavior change — still calls `platformCompaniesApi.provisionCompany`, which now delegates server-side) |

### Frontend — KEEP AS-IS

- `traccar-fleet-system/frontend/src/settings/center/organizationApi.js`, `OrganizationSection.jsx` (Workflow C) — untouched.
- `traccar-fleet-system/frontend/src/saas/components/ContextSelector.jsx`, `SaaSSidebar.jsx`, `PlatformOverviewPage.jsx` — untouched.

### Frontend — DEFERRED

- `traccar-fleet-system/frontend/src/settings/center/sections/PlatformCompaniesSection.jsx` — kept functioning (backed by the now-consolidated backend), not redirected/removed yet. Whether it becomes a redirect to `/saas/platform/direct-customers` or stays as a distinct "admin invite" view is a **decision needed** (§10) once the SaaS pages have full admin-invite parity.

---

## 6. Database Migration Requirements

**Primary finding: no new tables, no new required columns.** The audit already confirmed the existing `companies` schema (`organization_type`, `parent_company_id`, `status`, `settings`, `traccar_group_id`) is sufficient for the canonical model. This plan is a **code consolidation**, not a schema migration.

Two **optional**, non-blocking hardening items worth a small follow-up migration (not required to ship the consolidation):

1. **DB-level CHECK constraint** on `organization_type` (currently just `VARCHAR(20)` with an application-level default, no constraint):
   ```sql
   ALTER TABLE companies
     ADD CONSTRAINT companies_organization_type_check
     CHECK (organization_type IN ('partner', 'customer'));
   ```
   Safe to add now — the audit confirmed 0 rows currently violate this. Purely a defense-in-depth measure against a future bad write bypassing `organizationService.js`.

2. **DB-level CHECK** enforcing "a partner never has a parent":
   ```sql
   ALTER TABLE companies
     ADD CONSTRAINT companies_partner_has_no_parent_check
     CHECK (organization_type <> 'partner' OR parent_company_id IS NULL);
   ```
   Also currently satisfied by all 292 rows per the audit (0 violations found).

**Recommendation:** ship the code consolidation first without these; add both constraints in a small follow-up migration once the consolidated code has been running for a while, purely as a safety net (belt-and-suspenders, not blocking).

**No migration needed for:** `active_contexts` (Phase 2D, unaffected), `numz_users`, `company_devices` — none of their schemas change.

---

## 7. API Changes (contract-level)

| Endpoint | Method | Change |
|---|---|---|
| `POST /api/partners` | existing | Request body gains optional `admin: {name, email, phone, password}`. Response gains optional `admin: {traccarUserId, name, email, temporaryPassword}` when supplied. No change when `admin` omitted. |
| `POST /api/direct-customers` | existing | Same pattern |
| `POST /api/partners/:partnerId/customers` | existing | Same pattern |
| `POST /api/my-customers` | existing | Same pattern (partner self-service inviting their own customer's first admin) |
| `POST /api/partners/:id/admin` | **new** | Invite/provision an admin for an existing Partner that doesn't have one yet |
| `POST /api/direct-customers/:id/admin` | **new** | Same, for a Direct Customer |
| `POST /api/partners/:partnerId/customers/:id/admin` | **new** | Same, for a Partner's Customer |
| `POST /api/platform/companies` | existing (legacy) | **No visible contract change** — still accepts `{company, admin}`, still returns `{company, admin}`. Internally now delegates to `organizationService.createDirectCustomer`. |
| `GET /api/platform/companies` | existing (legacy) | Unchanged response shape; **decision needed** whether to keep listing ALL companies or narrow to Direct Customers only (see §10) |

All new/changed request bodies are strictly additive (`admin` is optional everywhere) — no existing frontend caller breaks if it never sends `admin`.

---

## 8. Test Changes

| File | Change |
|---|---|
| `fuel-api/src/services/organizationProvisioningService.test.js` | **New.** Unit-test the extracted helper: validates admin input, creates Traccar user with `isManager:true`/`administrator:false`, creates `numz_users` row, assigns `company_admin` role, returns temp password once. Mock the Traccar HTTP call. |
| `fuel-api/src/services/organizationService.test.js` | **New or extended.** `createPartner`/`createDirectCustomer`/`createCustomerUnderPartner` with and without `admin` — assert `organization_type`/`parent_company_id` always explicit either way; assert Traccar group always created; assert admin path produces a real `numz_users` row + role; assert no-admin path matches today's exact behavior (regression guard). |
| `fuel-api/src/modules/platform/companiesService.test.js` | **New.** Confirms `provisionCompany()` still produces byte-for-byte the same response shape as before, while now setting `organization_type='customer'`/`parent_company_id=null` explicitly (was implicit before). |
| `fuel-api/src/routes/organizations.test.js` | **Fix (independent of this plan, do first):** add `after()` cleanup — this test file is the dominant source of the 66% DB pollution the audit found, and will keep growing regardless of this consolidation unless fixed. |
| `fuel-api/src/services/tenantResolverService.test.js` | **No change required** — re-run as a regression guard; all 17 tests must stay green since `organization_type`/`parent_company_id` semantics are unchanged, only *how* they get set gains an admin-provisioning side effect. |
| Frontend: `saas/pages/PartnersPage.jsx`, `DirectCustomersPage.jsx` | Manual/E2E: create Partner/Direct Customer both with and without admin fields; confirm optional section collapses by default (no forced new friction for existing users) |
| Frontend: `settings/center/components/CreateCompanyDialog.jsx` | Manual: confirm identical behavior after refactor to shared components |

**Regression suite to re-run in full before considering this done:** `node --test --test-concurrency=1 src` (fuel-api) → must stay 0 failures (concurrency flag still needed until `organizations.test.js` gets its cleanup hook — see above); `npm run build` (frontend) → must stay 0 errors.

---

## 9. Rollback Strategy

This consolidation is designed to be low-risk and reversible at every stage because it is **additive, not destructive**:

1. **No schema changes required** (§6) → nothing to roll back at the database level in the primary plan. If the optional CHECK constraints (§6) are added later and need reverting: `ALTER TABLE companies DROP CONSTRAINT ...` — trivial, no data loss.
2. **No data migration** → existing 292 companies are untouched; the 3 real tenants and 5 seeded fixtures keep working exactly as today.
3. **Code rollback is a plain revert.** Each stage is a self-contained commit/PR:
   - Stage 1: extract `organizationProvisioningService.js` (pure refactor, `companiesService.js` unchanged behavior) — revert = revert this one commit, zero risk.
   - Stage 2: add optional `admin` param to `organizationService.js`'s three create functions — additive; if broken, revert this commit, old bare-company behavior returns immediately (default `admin` path is a no-op).
   - Stage 3: rewrite `companiesService.js: provisionCompany()` to delegate — revert = restore the old direct `Company.create()` call; both produce identical output, so this is safe to revert independently of Stage 2.
   - Stage 4: frontend admin-invite UI additions — revert = remove the new optional form section; existing name/slug-only flow is unaffected since it was never removed, only extended.
   - Stage 5 (deferred, separate decision): retiring/redirecting `PlatformCompaniesSection.jsx` or narrowing `GET /api/platform/companies` — do not ship until Stages 1–4 have been running without incident; trivially revertible (restore the old component/route) since Stage 3 keeps the legacy endpoint's contract unchanged throughout.
4. **Feature flag option (recommended for Stage 2–4):** gate the new "Add first administrator" UI section behind a simple boolean (e.g. `VITE_ENABLE_ORG_ADMIN_INVITE`), so it can be hidden instantly without a code revert if something looks wrong in production, while the backend capability remains available for direct API testing.
5. **Test suite as the safety net:** every stage must pass the full regression list in §8 before merging; if a stage causes `tenantResolverService.test.js` or `organizations.test.js` to fail, that stage does not ship until fixed — Phase 2D's context-switching correctness is treated as a hard gate, not something this refactor is allowed to regress.

---

## 10. Decisions Needed Before Implementation (not resolved by this plan)

1. **`GET /api/platform/companies` — keep listing all companies, or narrow to Direct Customers only?** Narrowing better reflects reality (this page has always been a Direct-Customer-shaped list) but changes what platform owners see today (they'd stop seeing Partners in this specific list, though they'd still see them in `/saas/platform/partners`).
2. **New admin-invite route shape** — one generic `POST /api/organizations/:id/admin` (simpler, one controller) vs. three type-specific routes (`/api/partners/:id/admin`, etc. — more consistent with the existing route style in `organizations.js`). Recommend the type-specific style for consistency, but either works.
3. **Fate of `Settings → Platform → Companies` long-term** (audit §12/§7): redirect entirely into the SaaS pages once they have full admin-invite parity, or keep it permanently as a distinct "admin/support" view. This plan makes either outcome possible later without rework — it does not need to be decided to start Stage 1.
4. **Whether to require `admin` on every future create, or keep it permanently optional.** This plan defaults to "permanently optional" (matches current SaaS UX, lowest friction) — flag if the business actually wants every new Partner/Customer to require an immediate admin invite.

---

## 11. Suggested Sequencing (once approved)

```
Stage 0 (independent, do anytime): add after() cleanup to organizations.test.js
Stage 1: extract organizationProvisioningService.js (pure refactor, no behavior change)
Stage 2: add optional `admin` param to organizationService.js's three create functions
Stage 3: rewrite modules/platform/companiesService.js to delegate (legacy endpoint unaffected externally)
Stage 4: frontend — shared AdminInviteFields/AdminCredentialsResult components + wire into PartnersPage/DirectCustomersPage
Stage 5 (separate decision, later): resolve §10's open decisions; retire or redirect Settings → Platform → Companies
```
Each stage ships independently, is tested independently (§8), and is revertible independently (§9). **Nothing in this plan is implemented yet — this is the design only, per your instruction.**
