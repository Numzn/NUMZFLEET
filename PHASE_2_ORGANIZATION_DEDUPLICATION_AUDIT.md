# Phase 2 — Organization/Company Deduplication Audit

**Status:** Audit only. No destructive changes made. No code changed. No SQL executed beyond read-only `SELECT`.
**Scope:** Full repository + database inventory of every company/organization/partner/customer concept in NUMZFLEET, per the Phase 2D pause request.
**Conclusion (short version):** The two workflows the user observed in the UI are real and confirmed. There is also a **third, non-competing** workflow (self-service "my organization" settings) that should not be touched. The two competing workflows are NOT equivalent in capability — one provisions a usable tenant (admin login + Traccar group), the other creates a "headless" `companies` row with no login capability at all. The database is ~66% test-data pollution, concentrated in the pre-existing `organizations.test.js` (not created by this session), which has no cleanup hook.

---

## 1. Current Architecture

NUMZFLEET has **one** underlying table, `companies` (Postgres, via Sequelize model `Company`), but **three** independent code paths that read/write it, built at different times with different intentions:

```
                         companies (single table)
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                          │
   WORKFLOW A                WORKFLOW B                  WORKFLOW C
 "Company Provisioning"    "Partner/Customer SaaS"    "My Organization"
  (documented v1, in         (undocumented, built      (self-service,
   docs/PLATFORM_          this conversation,           read/patch own
   ARCHITECTURE.md)          Phase 2B–2D)                company only —
        │                         │                       NOT a creation
   Settings → Platform →    SaaS → Platform →              workflow, does
   Companies → Create        Partners / Direct              NOT compete)
   Company                   Customers / Partner
        │                    Customers
   Creates: Company +             │
   Traccar admin user +      Creates: Company ONLY
   NumzUser + company_admin  (organization_type +
   role + Traccar group      parent_company_id set,
        │                    no admin user, no
   Result: usable tenant     Traccar group)
   (someone can log in)           │
                              Result: "headless" row —
                              nobody can log into it,
                              no Traccar device group
```

Both Workflow A and Workflow B write to the exact same `companies` table with the exact same schema, but:
- Workflow A never explicitly sets `organization_type`/`parent_company_id` (they fall back to the Sequelize model defaults: `organization_type = 'customer'`, `parent_company_id = NULL`) — so every company created via "Settings → Platform → Companies" is silently indistinguishable from a **Direct Customer** in Workflow B's model, whether or not that was the operator's intent.
- Workflow B never provisions a Traccar admin user, a `numz_users` row, a role assignment, or a Traccar device group — so every Partner/Direct Customer/Partner-Customer created via the SaaS UI is **unusable as a real tenant**: nobody can log into it, and `docs/PLATFORM_ARCHITECTURE.md`'s "Anonymous company creation: Forbidden" rule is effectively bypassed (a company can exist with zero owning users).

---

## 2. All Company/Organization Workflows (inventory)

| # | Workflow | Entry point (UI) | Mount path | Purpose |
|---|----------|-------------------|-----------|---------|
| A | Company Provisioning (documented v1) | Settings → Platform → Companies → "Create company" | `POST/GET /api/platform/companies` | Provision a brand-new tenant: Company + Traccar admin user + NumzUser + `company_admin` role + Traccar group. Matches `docs/PLATFORM_ARCHITECTURE.md`'s "Company Provisioning Engine". |
| B1 | SaaS Partner creation | SaaS → Platform → Partners → "New Partner" | `POST/GET /api/partners` | Creates a bare `companies` row, `organization_type='partner'`, `parent_company_id=NULL`. No admin user. |
| B2 | SaaS Direct Customer creation | SaaS → Platform → Direct Customers → "New Customer" | `POST/GET /api/direct-customers` | Creates a bare `companies` row, `organization_type='customer'`, `parent_company_id=NULL`. No admin user. |
| B3 | SaaS Partner-Customer creation | SaaS → Platform → Partners → (not yet built) / `POST /api/my-customers` (partner self-service) | `POST /api/partners/:id/customers`, `POST /api/my-customers` | Creates a bare `companies` row, `organization_type='customer'`, `parent_company_id=<partner id>`. No admin user. |
| C | My Organization (self-service) | Settings → Organization | `GET/PATCH /api/organization` | Reads/edits the CURRENT user's own company (name, settings/branding). **Not a creation workflow — does not compete.** |
| D | Context switching (Phase 2D, this conversation) | ContextSelector (SaaS top bar) | `POST /api/context/switch/:id`, `POST /api/context/reset` | Operates on top of whichever `companies` rows already exist (from A or B). Not itself a creation workflow, but its authorization model (`organization_type`/`parent_company_id`-based) only makes sense for rows shaped like Workflow B's output. |

---

## 3. Duplicate Implementations — Hard Evidence

### 3.1 Backend

| File | Role | Table | Sets `organization_type`? | Sets `parent_company_id`? | Creates Traccar user? | Creates `numz_users` row? | Creates Traccar group? |
|---|---|---|---|---|---|---|---|
| `fuel-api/src/modules/platform/{routes,companiesController,companiesService,companiesRepository}.js` | Workflow A | `companies` | **No** (defaults to `'customer'`) | **No** (defaults to `NULL`) | **Yes** (`POST /api/users` to Traccar) | **Yes** (`createNumzUserForAdmin`) | **Yes** (`ensureCompanyTraccarGroup`) |
| `fuel-api/src/routes/organizations.js` + `fuel-api/src/controllers/organizationController.js` + `fuel-api/src/services/organizationService.js` | Workflow B | `companies` | **Yes**, explicit (`partner`/`customer`) | **Yes**, explicit (`NULL` or partner id) | **No** | **No** | **No** |

Both write the identical `companies` table (confirmed via `fuel-api/src/models/index.js` — one `Company` Sequelize model, no separate table). Both are mounted directly on the Express `app` (`server.js`):
```js
app.use('/api/platform', platformRouter);       // Workflow A
app.use('/api', organizationsRouter);            // Workflow B (routes: /partners, /direct-customers, /my-customers, /context/*, /platform/overview)
```
Note the accidental near-collision: Workflow A is mounted at `/api/platform` (companies only), Workflow B separately defines `GET /api/platform/overview` inside the SAME `organizationsRouter` mounted at bare `/api`. These do not currently collide (different subpaths), but it means **`/api/platform/*` is split across two unrelated router files** — a maintainability hazard independent of the deduplication issue.

### 3.2 Frontend

| File | Purpose | Calls |
|---|---|---|
| `traccar-fleet-system/frontend/src/settings/center/platformCompaniesApi.js` | Workflow A client | `fetchCompanies`, `provisionCompany` → `/api/platform/companies` |
| `traccar-fleet-system/frontend/src/settings/center/sections/PlatformCompaniesSection.jsx` | Workflow A page | Renders company list + "Create company" button |
| `traccar-fleet-system/frontend/src/settings/center/components/CreateCompanyDialog.jsx` | Workflow A form | Company name/slug/contact + admin name/email/phone/password |
| `traccar-fleet-system/frontend/src/saas/organizationApi.js` | Workflow B client | `fetchPartners`, `createPartner`, `fetchDirectCustomers`, `createDirectCustomer`, `fetchPartnerCustomers`, `createPartnerCustomer`, `switchContext`, `resetContext`(local addition, not yet exported — see note below), `fetchMyCustomers`, `createMyCustomer`, `fetchPlatformOverview` |
| `traccar-fleet-system/frontend/src/saas/pages/PartnersPage.jsx` | Workflow B page | List Partners + "New Partner" form (name + slug only) |
| `traccar-fleet-system/frontend/src/saas/pages/DirectCustomersPage.jsx` | Workflow B page | List Direct Customers + "New Customer" form (name + slug only) |
| `traccar-fleet-system/frontend/src/saas/pages/PlatformOverviewPage.jsx` | Workflow B page | Aggregate counts (partners/direct customers/partner customers) |
| `traccar-fleet-system/frontend/src/settings/center/organizationApi.js` | Workflow C client | `fetchOrganization`, `updateOrganization` → `/api/organization` (self-service, non-competing) |
| `traccar-fleet-system/frontend/src/settings/center/sections/OrganizationSection.jsx` | Workflow C page | "Your organization" name/branding edit — reads own company only |

**Confirmed:** two entirely separate "Create Company"-shaped React forms exist (`CreateCompanyDialog.jsx` vs. the inline dialogs in `PartnersPage.jsx`/`DirectCustomersPage.jsx`), with **different required fields** (Workflow A requires a first-admin name/email/password; Workflow B requires only name/slug).

### 3.3 Answering the 10 duplication questions (per company/organization pair)

| Question | Workflow A vs B |
|---|---|
| 1. Same `companies` table? | Yes |
| 2. Same schema? | Yes (same Sequelize model) |
| 3. Sets `organization_type`? | A: no (default `customer`) · B: yes, explicit |
| 4. Sets `parent_company_id`? | A: no (default `NULL`) · B: yes, explicit |
| 5. Enforces hierarchy rules? | A: N/A (doesn't reason about hierarchy at all) · B: yes (`createCustomerUnderPartner` validates parent is a `partner`) |
| 6. Participates in tenant resolution? | Both — `tenantResolverService.js` reads `companies.organization_type`/`parent_company_id` regardless of which workflow created the row |
| 7. Participates in context switching? | Both — `switchActiveContext`/`canAccessCompany` operate on whatever `organization_type`/`parent_company_id` the row happens to have, regardless of origin |
| 8. Participates in fleet company scoping? | Both — `company_id` foreign keys (vehicles, devices, etc.) don't care which workflow created the parent company |
| 9. Different validation? | Yes — A requires name/slug/contact + admin name/email/password (≥6 chars); B requires only name/slug |
| 10. Different data depending on which UI created it? | **Yes, confirmed** — A-created rows always end up `organization_type='customer'`, `parent_company_id=NULL` (whether the operator meant "Direct Customer" or not) and **do** get a real login-capable admin + Traccar group; B-created rows get the `organization_type`/`parent_company_id` the operator explicitly picked but **never** get an admin or Traccar group |

---

## 4. Settings → Platform → Companies — Full Trace

```
Settings (SettingsCenterShell)
  ↓
PlatformCompaniesSection.jsx        (traccar-fleet-system/frontend/src/settings/center/sections/)
  ↓ fetchCompanies(user) / opens CreateCompanyDialog
platformCompaniesApi.js             (…/settings/center/platformCompaniesApi.js)
  ↓ GET/POST /api/platform/companies  (fetchOrThrow + fuelApiAuthHeaders)
modules/platform/routes.js          (fuel-api/src/modules/platform/routes.js)
  ↓ authenticate → attachTenantContext → requireAuth + requirePlatformOwner
modules/platform/companiesController.js
  ↓ listCompanies() / provisionCompany(req)
modules/platform/companiesService.js
  ↓ validateInput() (company.name/slug + admin.name/email/password ≥6 chars)
  ↓ 1. POST Traccar /api/users (administrator:false, attributes.isManager:true)
  ↓ 2. repo.createCompanyDraft(companyInput)   — status:'provisioning', DEFAULT_SETTINGS
  ↓ 3. ensureCompanyTraccarGroup(company.id)
  ↓ 4. repo.createNumzUserForAdmin({traccarUserId, email, companyId})
  ↓ 5. Role.findOne({key:'company_admin', companyId:null}) → UserRole.findOrCreate
  ↓ 6. repo.activateCompany(company.id)         — status:'active'
modules/platform/companiesRepository.js
  ↓ Company.create({name, slug, status:'provisioning', settings:{...DEFAULT_SETTINGS}})
companies table
```

**Fields written:** `name`, `slug`, `status` (`provisioning` → `active`), `settings` (timezone/currency/fuelUnits/branding/features JSON). **`organization_type` and `parent_company_id` are never referenced anywhere in this file** — they are left at the Sequelize column defaults (`'customer'`, `NULL`).

**Does it understand Partner vs. Customer?** No — this workflow has no concept of "Partner" at all. Every company it creates is, by omission, a `customer` with no parent (= a "Direct Customer" in Workflow B's vocabulary), regardless of the operator's actual intent.

**Does it bypass the SaaS organization service?** Yes, completely — it calls `Company.create()` directly via its own repository, never touching `organizationService.js`.

**Does it create records the SaaS UI cannot understand?** No — the SaaS UI (`getOrganizationOverview`, `listDirectCustomers`) WILL show these rows (since `organization_type` defaults to `'customer'`, `parent_company_id` defaults to `NULL`, which is exactly the Direct Customer query shape: `WHERE organization_type='customer' AND parent_company_id IS NULL`). So Workflow-A-created companies silently appear in the SaaS "Direct Customers" list — which is correct-by-coincidence, not by design.

---

## 5. Partner Workflow — Trace

```
SaaS → Platform → Partners → "New Partner"
  ↓
PartnersPage.jsx (name + slug only)
  ↓
saas/organizationApi.js → createPartner(user, {name, slug, traccarGroupId: null})
  ↓ POST /api/partners (fetchOrThrow + fuelApiAuthHeaders)
routes/organizations.js → authenticate → attachTenantContext → requirePlatformOwner
  ↓
controllers/organizationController.js → createPartnerOrg
  ↓
services/organizationService.js → createPartner({name, slug, traccarGroupId})
  ↓ validate slug uniqueness
  ↓ Company.create({slug, name, traccarGroupId: traccarGroupId||null, organizationType:'partner', parentCompanyId:null, status:'active'})
companies table
```
No Traccar user, no `numz_users` row, no role assignment, no `ensureCompanyTraccarGroup` call (the caller may pass a pre-existing `traccarGroupId`, but nothing creates one). Result: a Partner that exists in the database and is visible/switchable in the SaaS UI, but has **no human who can log in as it** and (unless a `traccarGroupId` was manually supplied) **no Traccar device group**.

---

## 6. Customer Workflow — Trace

Two customer-creation paths exist, both in `organizationService.js`:

```
A) Direct Customer:  SaaS → Platform → Direct Customers → "New Customer"
   → createDirectCustomer({name, slug, traccarGroupId})
   → Company.create({..., organizationType:'customer', parentCompanyId:null, status:'active'})

B) Partner's own Customer: (backend exists; no dedicated frontend page yet)
   → POST /api/partners/:partnerId/customers  (platform admin, explicit partnerId)
   → createCustomerUnderPartner({partnerId, name, slug, traccarGroupId})
   → validates Company.findByPk(partnerId).organizationType === 'partner'
   → Company.create({..., organizationType:'customer', parentCompanyId:partnerId, status:'active'})

C) Partner self-service: POST /api/my-customers (requirePartner gate, uses req.auth.activeContext.companyId as partnerId)
   → createCustomerUnderPartner({partnerId: activeContext.companyId, ...})
```
Same lack of admin-user/Traccar-group provisioning as the Partner path.

---

## 7. Database Inventory (dev DB, `numztrak_fuel`, live counts at audit time)

| Metric | Count |
|---|---|
| Total companies | **292** |
| `organization_type = 'partner'` | 140 |
| `organization_type = 'customer'` | 152 |
| `organization_type` NULL or invalid | 0 |
| `parent_company_id` NOT NULL | 94 |
| `parent_company_id` NULL | 198 |
| Orphaned `parent_company_id` (points to nothing) | 0 |
| Customer whose parent is NOT a partner | 0 |
| Partner with a parent set (should never happen) | 0 |
| Duplicate slugs | 0 |
| Duplicate names (16 distinct name-groups) | see §8 |
| `status = 'provisioning'` (stuck mid-provision) | 0 |
| `status = 'active'` | 292 |
| Companies with **zero** `numz_users` (no possible login) | **289** |
| Companies with ≥1 `numz_users` (real, usable tenants) | **3** |
| Companies with a `traccar_group_id` set | 3 |
| Companies with ≥1 vehicle | 6 |
| Companies with ≥1 `company_devices` row | 0 |
| Companies with ≥1 `operation_sessions` row | 1 |

**Hierarchy integrity is currently clean** (no orphans, no invalid parent/child type combinations) — the *data* is fine; the *duplication of creation paths* is the problem, not corruption.

**The "3 real tenants"** (have an actual admin user, i.e. were provisioned through Workflow A or seeded directly):

| Name | Slug | organization_type | numz_users | vehicles | traccar_group_id |
|---|---|---|---|---|---|
| Default Fleet | `default` | customer | 1 | 1 | 1 |
| Acme Logistics | `acme-logistics` | customer | 1 | 0 | 2 |
| POSHMEDIA | `poshmedia` | customer | 1 | 0 | 3 |

**Seeded demo/fixture data** (deterministic UUIDs like `10000000-0000-0000-0000-000000000001`, clearly intentional fixtures representing the target hierarchy, e.g. "Posh (Partner)" → "ABC (Customer)"/"XYZ (Customer)"): 5 companies, all with exactly 1 vehicle each, 0 `numz_users`. These look like **deliberately seeded example data for the Partner/Customer hierarchy demo** — not created by either live UI workflow, likely a fixture/seed script. Recommend **KEEP** pending confirmation, since deleting them would remove demo vehicles.

---

## 8. Duplicate / Test-Data Candidates

192 of 292 companies (66%) match test-pollution patterns (`%test%`, `%isolation%`, `%verify%`, timestamp-suffixed slugs, `other-partner-%`, `test-%`, `integ-%`):

| Name (16 duplicate-name groups) | Count | Likely source |
|---|---|---|
| Partner B | 19 | `organizations.test.js` (pre-existing, no cleanup hook) |
| Overview Test Child Customer | 18 | `organizations.test.js` |
| Customer under A | 18 | `organizations.test.js` |
| First Company | 18 | `organizations.test.js` |
| Query Test Child Customer | 18 | `organizations.test.js` |
| Test Partner | 18 | `organizations.test.js` |
| Overview Test Direct Customer | 18 | `organizations.test.js` |
| Test Partner for Children | 18 | `organizations.test.js` |
| Overview Test Partner | 18 | `organizations.test.js` |
| Customer under B | 18 | `organizations.test.js` |
| Test Direct Customer | 18 | `organizations.test.js` |
| Test Child Customer | 18 | `organizations.test.js` |
| Query Test Partner | 18 | `organizations.test.js` |
| Partner A | 18 | `organizations.test.js` |
| Query Test Direct Customer | 18 | `organizations.test.js` |
| Another Partner For Isolation Test | 12 | Manual live-testing session (this or a prior conversation) |

**Root cause confirmed:** `fuel-api/src/routes/organizations.test.js` (the pre-existing Phase 2B test file — not created or modified in this conversation) creates real `Company` rows in every test run (`Company.create(...)`) with **no `after()`/teardown hook at all**. Every `node --test` invocation of the full suite — and every developer running it locally — permanently adds ~18 more rows. This is the dominant source of the pollution the live-testing phase already flagged, and it is still actively growing with every test run.

By contrast, the new `fuel-api/src/services/tenantResolverService.test.js` (added in Phase 2D) uses a unique slug/email prefix + a top-level `after()` hook that deletes everything it created, including `active_contexts` override rows — it leaves zero residue.

---

## 9. Foreign-Key / Dependency Analysis

Before any deletion, the following tables reference `companies.id` and must be checked per-row:

```
vehicles.company_id            → 6 companies have ≥1 vehicle
numz_users.company_id          → 3 companies have ≥1 user
company_devices.company_id     → 0 companies currently have any
operation_sessions.company_id  → 1 company has ≥1 session
active_contexts.company_id     → 0 rows currently (verified clean after Phase 2D testing)
companies.parent_company_id    → 94 rows reference another company (all valid, no orphans)
fuel_requests, service_records, maintenance_budget, roles, user_roles — also carry company_id
  FKs (not separately queried in this pass; must be checked before any real deletion)
```
`parent_company_id` has `ON DELETE RESTRICT` (per `20260811_partner_reseller_model.sql`) — Postgres will refuse to delete a partner that still has child customers, which is a good existing safety net. `vehicles.company_id`/`numz_users.company_id` have no `ON DELETE` behavior confirmed in this pass — deleting a company with dependent vehicles/users would need an explicit decision (cascade vs. block vs. reassign), not silently allowed.

**None of the 192 test-pollution candidates identified in §8 have any vehicles, users, devices, or operation sessions** (cross-referencing §7's "companies with vehicles/users" list — all 3 real tenants + 5 seeded fixtures are named differently and don't appear in the test-name patterns). This means the obvious test rows are very likely safe to delete from a foreign-key standpoint, but this audit does **not** execute that deletion — see §14.

---

## 10. Recommended Canonical Architecture (proposal only — not implemented)

Adopt **Workflow B's data model** (`organization_type`/`parent_company_id`, already correctly enforced) as canonical, but require **every** creation path to also perform **Workflow A's provisioning steps** (Traccar admin user + `numz_users` row + role + Traccar group) — or make provisioning explicitly optional per-call with a clear default. Concretely:

```
One OrganizationProvisioningService, three narrow entry points:
  createPartner({name, slug, ...})
  createDirectCustomer({name, slug, ...})
  createCustomerUnderPartner({partnerId, name, slug, ...})

Each internally:
  1. INSERT companies (organization_type + parent_company_id set explicitly — never left to defaults)
  2. ensureCompanyTraccarGroup()
  3. (optional, admin-invite flow) create first admin: Traccar user + numz_users + role
  4. status: provisioning → active
```
`Settings → Platform → Companies` either becomes a thin view over this same service (letting the operator pick Partner/Direct Customer/Partner-Customer instead of only ever producing a Direct-Customer-shaped row), or is retired in favor of the SaaS Partner/Direct Customer/Partner-Customer pages once those gain first-admin-invite capability.

This is a proposal for Phase 6+ discussion — **not something this audit implements**.

---

## 11. Files That Should Be Retained

- `fuel-api/src/models/Company.js`, `fuel-api/src/models/index.js` — single source-of-truth schema, keep as-is.
- `fuel-api/src/services/organizationService.js` + `fuel-api/src/controllers/organizationController.js` + `fuel-api/src/routes/organizations.js` — correct hierarchy semantics (`organization_type`/`parent_company_id`), should become (or feed) the canonical service.
- `fuel-api/src/services/companyProvisioningService.js` (`ensureCompanyTraccarGroup`) — reusable, should be called from BOTH workflows going forward.
- `fuel-api/src/modules/organization/*` (Workflow C, self-service) — non-competing, keep unchanged.
- `fuel-api/src/services/tenantResolverService.js`, `scopeValidationService.js`, `authGates.js`, `active_contexts` (Phase 2D) — context/authorization layer, correct, independent of which workflow created a row.
- Frontend: `saas/organizationApi.js`, `saas/pages/{PartnersPage,DirectCustomersPage,PlatformOverviewPage}.jsx`, `ContextSelector.jsx`, `SaaSSidebar.jsx` — correct hierarchy UI, becomes canonical once first-admin provisioning is added.
- Frontend: `settings/center/organizationApi.js`, `OrganizationSection.jsx` — Workflow C, non-competing, keep unchanged.

## 12. Files/Routes/Components That Should Be Deprecated (pending Phase 6 decision, not done here)

- `fuel-api/src/modules/platform/{routes,companiesController,companiesService,companiesRepository}.js` (`/api/platform/companies`) — candidate for retirement **only if** its unique value (first-admin provisioning + Traccar group creation) is folded into the canonical `organizationService.js` first. Do not remove before that capability exists elsewhere, or NUMZFLEET loses its only way to create a tenant anyone can actually log into.
- `traccar-fleet-system/frontend/src/settings/center/sections/PlatformCompaniesSection.jsx` + `CreateCompanyDialog.jsx` (`/settings/platform/companies`) — same caveat; either redirect to the canonical SaaS Partners/Direct Customers UI (once it supports first-admin invites) or keep as the ONLY place an admin gets provisioned and make the SaaS pages call into it instead of `Company.create()` directly.
- `fuel-api/src/routes/organizations.test.js` — not for deletion, but **must** gain an `after()` cleanup hook (mirroring the pattern already used in `tenantResolverService.test.js`) before any further test runs, or the pollution in §8 will keep growing indefinitely.

## 13. Proposed Migration Plan (high-level, for Phase 6 — not executed)

1. Add first-admin provisioning (Traccar user + `numz_users` + role + Traccar group) as an *optional* step inside `organizationService.js`'s three `create*` functions, reusing `ensureCompanyTraccarGroup` and the Traccar-user-creation logic already in `companiesService.js` (extract to a shared helper, e.g. `provisionCompanyAdmin()`).
2. Update `PartnersPage.jsx`/`DirectCustomersPage.jsx` forms to optionally collect first-admin details (name/email/temp password), matching `CreateCompanyDialog.jsx`'s UX.
3. Point `Settings → Platform → Companies`'s "Create company" either (a) at the same canonical service with an explicit Partner/Direct-Customer/Partner-Customer choice, or (b) redirect entirely to the SaaS pages once they support first-admin invites.
4. Backfill: for the 3 real tenants + 5 seeded fixtures, no data change needed (already correctly shaped). No records need "migrating" — the schema is already unified; only the *creation code paths* need consolidating.
5. Add the missing `after()` cleanup hook to `organizations.test.js`.
6. Only after 1–5 are live and verified: retire (or redirect) the old `modules/platform/*` files and `PlatformCompaniesSection.jsx`/`CreateCompanyDialog.jsx`.

## 14. Proposed Cleanup SQL — DO NOT EXECUTE YET

Candidate DELETE (192 rows, matched by the exact patterns confirmed test-only in §8, zero dependent vehicles/users/devices/sessions per §9). For review only:

```sql
-- REVIEW ONLY. Do not run without explicit approval.
-- Verify zero dependents immediately before running, in case new data was added:
SELECT c.id, c.name, c.slug
FROM companies c
WHERE (c.name ILIKE '%test%' OR c.name ILIKE '%isolation%' OR c.name ILIKE '%verify%'
       OR c.slug ~ '[0-9]{10,}' OR c.slug ILIKE 'other-partner-%' OR c.slug ILIKE 'test-%' OR c.slug ILIKE 'integ-%')
  AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM numz_users u WHERE u.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM company_devices d WHERE d.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM operation_sessions o WHERE o.company_id = c.id);

-- If (and only if) the above SELECT still returns exactly the expected ~192 rows
-- with no surprises, the actual delete (children before parents, to respect
-- parent_company_id ON DELETE RESTRICT):
-- DELETE FROM companies
-- WHERE parent_company_id IS NOT NULL
--   AND (name ILIKE '%test%' OR name ILIKE '%isolation%' OR name ILIKE '%verify%'
--        OR slug ~ '[0-9]{10,}' OR slug ILIKE 'other-partner-%' OR slug ILIKE 'test-%' OR slug ILIKE 'integ-%');
-- DELETE FROM companies
-- WHERE (name ILIKE '%test%' OR name ILIKE '%isolation%' OR name ILIKE '%verify%'
--        OR slug ~ '[0-9]{10,}' OR slug ILIKE 'other-partner-%' OR slug ILIKE 'test-%' OR slug ILIKE 'integ-%');
```
**REVIEW/ambiguous, not included above:** the 5 seeded fixture companies ("Posh (Partner)", "ABC (Customer)", "XYZ (Customer)", "Customer B1", "Direct Customer" — deterministic UUIDs, each with 1 vehicle) — do not match the test-name patterns and are NOT part of this candidate DELETE list. Classify as **REVIEW** until their origin (seed script vs. intentional demo data) is confirmed with the user.

## 15. Test Plan (for Phase 6, once consolidation lands)

1. Create Partner via canonical service → verify `organization_type='partner'`, `parent_company_id=NULL`, admin user can log in (if provisioning enabled), Traccar group exists.
2. Create Direct Customer → same checks, `organization_type='customer'`.
3. Create Customer under Partner → `parent_company_id` = partner id.
4. Confirm all three go through ONE service/table with ONE validation layer.
5. Confirm hierarchy constraints (`partner` cannot have a parent; `customer`'s parent, if any, must be a `partner`) — already enforced in `organizationService.js`, re-verify post-consolidation.
6. Re-run the Phase 2D tenant-resolution/context-switching/fleet-scoping test suite (`tenantResolverService.test.js`, 17 tests) — must remain green.
7. Confirm `Settings → Platform → Companies` no longer produces a row indistinguishable from a Direct Customer by accident (either it now sets `organization_type` explicitly, or it's redirected to the canonical UI).
8. Confirm the two "Create Company" experiences have been reduced to one (or the legacy one now delegates to the canonical service instead of calling `Company.create()` directly).
9. `npm test` (fuel-api) → 0 failures (run with `--test-concurrency=1` given the pre-existing cross-file DB-count race documented in the Phase 2D report).
10. `npm run build` (frontend) → 0 errors.

---

## Appendix: Files Read For This Audit

Backend: `modules/platform/{routes,companiesController,companiesService,companiesRepository}.js`, `modules/organization/{routes,organizationController,organizationService,organizationRepository}.js`, `routes/organizations.js`, `controllers/organizationController.js`, `services/organizationService.js`, `services/companyProvisioningService.js` (referenced), `models/Company.js`, `models/index.js`, `server.js`, `migrations/20260811_partner_reseller_model.sql`, `migrations/20260811_remove_company_relationships.sql`, `docs/PLATFORM_ARCHITECTURE.md`.

Frontend: `settings/center/platformCompaniesApi.js`, `settings/center/sections/PlatformCompaniesSection.jsx`, `settings/center/components/CreateCompanyDialog.jsx`, `settings/center/organizationApi.js`, `settings/center/sections/OrganizationSection.jsx`, `settings/center/settingsSectionRegistry.js`, `saas/organizationApi.js`, `saas/pages/{PartnersPage,DirectCustomersPage,PlatformOverviewPage}.jsx`, `saas/components/ContextSelector.jsx`.

Database: live `numztrak_fuel` Postgres instance (`companies`, `numz_users`, `vehicles`, `company_devices`, `operation_sessions`, `active_contexts` tables), dev environment.

**No files were modified. No SQL beyond `SELECT` was executed. Stopping here per the audit-only instruction.**
