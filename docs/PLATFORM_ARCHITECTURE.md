# NUMZ Platform Architecture

**Status:** Frozen v2.0  
**Scope:** Platform identity, tenancy, context, permissions, service boundaries, provisioning, audit, UI modes, auth evolution  
**Does not cover:** Implementation code, API endpoint specs, database migration SQL  
**Applies to:** All work touching authentication, tenancy, company provisioning, platform navigation, or cross-tenant data access  

**Governance:** This document is authoritative. Pull requests that change tenancy, authentication, permissions, provisioning, or platform navigation must be reviewed against this specification. Deviations require a version bump and amendment here — not silent drift in code.

**v2.0 amendment (supersedes v1.1's context-switching model):** v1.1 specified a session-level context switch — a platform admin could "enter" a partner's or customer's workspace from inside their own session (`activeContext.type` toggling between `platform`/`company`, an exit banner, audited enter/exit events). That model was built, then deliberately reversed: **there is no cross-company context switching.** Every organization is an independent environment with its own login/session; `activeContext` always equals the identity's own home context (never an override); to operate a different organization's fleet you log out and log in as that organization. This is the permanent model, not an interim state pending a future phase. See [Active Context](#active-context) and [One organization per session (frozen)](#one-organization-per-session-frozen) below — both fully rewritten for v2.0. Sections describing other, still-aspirational target architecture (`ExecutionContext`, Platform/Company Services boundary, Provisioning Engine, Platform Health, platform audit table) are unaffected by this amendment; they remain the same forward-looking target they always were.

**Operational supplement:** [fuel-api/docs/ACCOUNTS_AND_TENANCY.md](../fuel-api/docs/ACCOUNTS_AND_TENANCY.md) (request flow, env vars, troubleshooting).

---

## Executive summary

NUMZFLEET is not a fleet application with multi-company support bolted on. It is the **first product** on a shared **NUMZ Platform** that owns tenants (companies), identity, permissions, audit, and licensing.

| Layer | Owner | Question answered |
|-------|-------|-------------------|
| **Authentication** | Traccar today → NUMZFLEET JWT later | Who is logged in? |
| **Execution Context** | fuel-api middleware | Where am I operating? With what permissions and resource scope? |
| **Business data** | PostgreSQL (`company_id`) | Which tenant owns this row? |
| **Telemetry** | Traccar (internal service long-term) | What did the device report? |
| **Company modules** | Fleet, Fuel, Maintenance, Vehicle Engine | What does this data mean for operations? |

**Core rule:** Platform is **not** a company. Platform owns companies. There is no `Company` row for the platform and no `company_type = platform`.

---

## NUMZ Platform positioning

```text
NUMZ Platform
├── Identity
├── Companies
├── Permissions
├── Licensing
├── Audit
├── Notifications
├── AI
│
├── Fleet          ← NUMZFLEET (this repo) today
├── Fuel
├── POS
├── Drive
├── Inventory
├── HR
└── Accounting
```

Every product consumes the same platform services. Products do not implement their own tenancy model.

---

## Architectural stack

```mermaid
flowchart TB
  subgraph auth [Authentication]
    TraccarToday[TraccarSessionToday]
    JwtLater[NUMZFLEETJwtLater]
  end

  subgraph ctx [ExecutionContext]
    User[User]
    ActiveContext[ActiveContext]
    Permissions[Permissions]
    ResourceScope[ResourceOwnership]
    Features[FeatureFlags]
    Locale[LocaleTimezoneCurrency]
  end

  subgraph authz [Authorization]
    CanRead[CanRead]
    CanManage[CanManage]
    CanApprove[CanApprove]
    ResourceFilter[ResourceFilter]
  end

  subgraph services [ServiceLayer]
    PlatformSvc[PlatformServices]
    CompanySvc[CompanyServices]
    Repos[RepositoriesApplyContext]
  end

  subgraph data [Data]
    PG[(PostgreSQL)]
  end

  TraccarToday --> ctx
  JwtLater -.-> ctx
  ctx --> authz
  authz --> PlatformSvc
  authz --> CompanySvc
  PlatformSvc --> Repos
  CompanySvc --> Repos
  Repos --> PG
```

---

## Four authorization dimensions

Every access decision answers four questions:

| Dimension | Question | v1 mechanism |
|-----------|----------|--------------|
| **Identity** | Who is logged in? | `numz_users` + Traccar user link |
| **Active Context** | Where am I operating? | Session `activeContext` |
| **Permissions** | What actions may I perform? | `numz_user_roles` + permission bundles |
| **Resource ownership** | Which records may I see? | Assignments + Traccar device ACLs |

### Rules

1. **Roles are permission bundles, not scope.** `super_admin` grants platform permissions; it does not assign a company.
2. **Context is not ownership.** A driver in Company ABC must not see every vehicle in ABC unless permission grants company-wide read.
3. **One question for all modules:** *What is the active context?* — not “is super admin?”, “is impersonating?”, “which company?”.

---

## Active Context

Replace ad-hoc `impersonatedCompanyId` and silent company fallback with a single session concept — but, per the v2.0 amendment above, **`activeContext` is derived once from identity and never overridden.** There is no session-level toggle, no "enter company," no "exit to platform." It is a read of the identity's own home context, not a piece of session state that can change value mid-session.

### Platform-only identity

A `numz_users` row with `company_id IS NULL` and `administrator: true` (or an explicit `platform_super_admin` role grant — see [Platform vs Company data model](#platform-vs-company-data-model)) has no home company at all:

```json
{
  "userId": 1,
  "homeCompanyId": null,
  "activeContext": {
    "type": "platform",
    "companyId": null
  },
  "permissions": ["platform.companies.read", "platform.companies.manage"]
}
```

Routes: `/saas/platform/*` — partner/customer directory, overview, provisioning.

### Company identity (partner or customer)

Every other identity has exactly one home company, and `activeContext` always equals it — including a **dual-capability identity** (a home company *and* `platform_super_admin`, e.g. the platform owner's own operational account): platform capability is reachable through Settings as a management surface, but it never becomes this session's `activeContext.type`.

```json
{
  "userId": 42,
  "homeCompanyId": "abc-uuid",
  "activeContext": {
    "type": "customer",
    "companyId": "abc-uuid"
  },
  "permissions": ["vehicles.read", "fuel.approve"]
}
```

Routes: `/vehicles`, Fuel Day, vehicle workspace, company settings.

### Extensibility

`activeContext.type` is `platform`, `partner`, or `customer` — the identity's own kind of organization, fixed for the life of the session. There is no per-request "which company am I acting as" question to answer; it does not need extending for deeper hierarchy (`branch`/`depot`/etc.) the way a switchable context would have, since operating a different organization is a different login, not a deeper context.

### UI modes

| `activeContext.type` | UI | Badge |
|---------------------|-----|--------|
| `platform` | Platform workspace | `NUMZ Platform` (informational only — never a dropdown or switcher) |
| `partner` / `customer` | Company workspace | The identity's own organization name |

A platform-capable identity that also has a home company sees their **own fleet as primary**, with Platform reachable under Settings — never the other way around, and never both at once in the same `activeContext`.

---

## One organization per session (frozen)

1. **No cross-company entry, ever.** There is no "enter company" action, no session-level override, no route that changes whose data the current session sees mid-session. `activeContext` is fixed at login for the life of the session.
2. **To operate a different organization's fleet, log out and log in as that organization.** Each organization is a fully independent environment with its own login/session — not a deeper level of the same session.
3. **The organization badge is purely informational.** No dropdown, no chevron, no workspace count, no switcher. It names which organization this session belongs to and nothing else.
4. **Partner and Customer records are management records, not gateways.** From Platform or Partner workspace, partner/customer cards show read-only summary data (name, counts). There is no "Enter Fleet," "Open as," "Login as," or "Impersonate" affordance anywhere in the UI — a card can never become a way into another organization's session.
5. **Route-based navigation gating, not context-based.** Since `activeContext.type` can never be `platform` for a dual-capability identity operating their own fleet, navigation resolves which nav group to show from the current route (`inPlatformArea`/`inPartnerAdmin`, see `common/util/navWorkspace.js`) in addition to `activeContext.type` — not from context alone.
6. **Scope boundary (frozen, not a bug):** Business data (vehicles, fuel operations, service records, `numz_users`, etc.) is filtered by `req.auth.companyId`, which is always the session's own home company. This is independent of what Traccar shows on the Live Map, device list, or Dashboard alerts — those are authorized purely by the operator's own real Traccar session and Traccar's own per-user device ACLs, managed separately (`company_devices` + Traccar groups, see [Data isolation rules](#data-isolation-rules)). Since there is no cross-company session at all under this model, this boundary is largely moot for fuel-api-owned data, but remains true for Traccar: logging in as Partner X's own account shows Partner X's own Traccar-authorized devices, not a borrowed view into them.

---

## Execution Context

**Primary name:** `ExecutionContext` — used for HTTP requests, background jobs, schedulers, webhooks, CLI tools, and future AI agents.

**v1 HTTP alias:** `RequestContext` = `ExecutionContext` built from an HTTP `req`. Code may expose `req.context`.

```text
authenticate(req) → resolveExecutionContext(req) → req.context
```

### Fields (v1)

| Field | Purpose |
|-------|---------|
| `user` | Identity (Traccar + `numz_users` link) |
| `activeContext` | Platform or company scope |
| `permissions[]` | Action grants |
| `resourceScope` | Optional filters (assigned vehicle ids, depot ids) |
| `features` | Company feature flags from `companies.settings` |
| `locale`, `timezone`, `currency` | Display and business rules |
| `metadata` | IP, user-agent, correlation id (audit) |

### Repository rules

```text
if activeContext.type === company
  → WHERE company_id = activeContext.companyId
  → apply resourceScope when user lacks company-wide read

if activeContext.type === platform
  → no company filter (platform APIs only)
```

**Frozen:** Controllers never apply `if (superAdmin)`. Repositories apply `ExecutionContext` via a shared helper.

### Transition from today

| Today | Target |
|-------|--------|
| `req.auth` in `tenantContext.js` | `req.context` (`ExecutionContext`) |
| `resolveCompanyContextForTraccarUser()` | `resolveExecutionContext()` |
| `tenantWhere(companyId)` | `ExecutionContext.applySequelizeWhere()` |

---

## Platform vs Company data model

```text
NUMZFLEET Platform
├── Company A
├── Company B
└── Company C
```

**Platform user:** `numz_users.company_id IS NULL`. Never assigned to the default company UUID.

**`DEFAULT_COMPANY_ID`** (`00000000-0000-0000-0000-000000000001`): retained for **historical row backfill** and single-tenant migration only. **Not** the runtime scope for unprovisioned users. Target: provision all humans in `numz_users`; remove silent fallback in `attachTenantContext`.

### Company lifecycle

| State | Meaning |
|-------|---------|
| `draft` | Created, not provisioned |
| `provisioning` | Traccar group, defaults, admin in progress |
| `active` | Normal operation |
| `suspended` | Login disabled, data retained |
| `archived` | Historical only |

### Company settings and feature flags (v1 in JSONB)

Stored in `companies.settings`:

```json
{
  "timezone": "Africa/Lusaka",
  "currency": "ZMW",
  "fuelUnits": "litres",
  "branding": { "logoUrl": null, "primaryColor": null },
  "features": {
    "fleet": true,
    "fuel": true,
    "maintenance": true,
    "expenses": false,
    "erp": false,
    "ai": false
  }
}
```

Peel into `company_settings` / `company_subscription` tables when billing requires querying — not before.

---

## Platform Services vs Company Services

### Platform Services

Operate in `activeContext.type === platform` or cross-tenant with explicit audit. **Must not** be imported by Company Services for tenant filtering.

| Service | Responsibility |
|---------|----------------|
| `CompanyProvisioningService` | Create, provision, suspend companies |
| `PlatformAuditService` | Cross-tenant audit events |
| `CompanyDirectoryService` | List, search companies, summaries |
| `LicenseService` | Feature flags, limits (v1: `companies.settings`) |
| `PlatformHealthService` | Aggregated health for `/platform` |

### Company Services

Always scoped by `activeContext.companyId` in company mode.

| Service | Responsibility |
|---------|----------------|
| Fleet (`vehicleFleetService`) | Vehicle registry, assignments |
| Fuel (operation sessions) | Fuel Day, refuels |
| Maintenance | Schedules, work orders |
| Vehicle Engine | Unified vehicle read model |
| Notifications (company) | Company-scoped alerts |

**Rule:** Company Services receive `ExecutionContext` only. They do not call Platform Services to resolve scope.

---

## Resource ownership

Third filter after company scope.

```text
Driver       → Company ABC → assigned Vehicle 18 only
Technician   → Company ABC → assigned depot/workshop vehicles
Dispatcher   → Company ABC → all vehicles (permission-granted)
```

### v1 mechanisms

- **Map visibility:** Traccar device permissions (existing)
- **Fleet registry:** `device_assignments` + driver links
- **Future:** `resource_grants (user_id, resource_type, resource_id, company_id)`

Repositories apply `company_id` filter **then** `resourceScope` when the user lacks company-wide read permission.

---

## Company Provisioning Engine

Single orchestrator — no scattered controller logic.

```text
CreateCompanyRequest
  → CompanyProvisioningService.provision()
      1. INSERT companies (status = provisioning)
      2. ensureCompanyTraccarGroup()
      3. default settings + feature flags
      4. seed roles / permissions template
      5. create first company admin (numz_users + Traccar user)
      6. emit CompanyProvisioned (domain event)
      7. status → active
```

Rules: idempotent steps, explicit failure/retry states, one transaction where possible.

### Domain events (document now, bus later)

Provisioning must not call every module inline.

| Event | Subscribers (future) |
|-------|---------------------|
| `CompanyCreated` | Audit, directory index |
| `CompanyProvisioned` | Notifications, default fuel config |
| `CompanySuspended` | Auth gate, notification |
| `CompanyContextEntered` | Platform audit |

v1 may use in-process listeners (pattern exists in `fuel-api/src/events/`). Synchronous inline calls are **transitional**.

---

## Platform Health

Minimum indicators for **Platform Mode** (`PlatformHealthService`):

| Indicator | Source | v1 |
|-----------|--------|-----|
| Companies by lifecycle state | `companies` | Yes |
| Active users | `numz_users` | Yes |
| Connected / offline trackers | Traccar + `company_devices` | Yes |
| Traccar connectivity | Traccar `/api/server` probe | Yes |
| Database health | connection pool / `pg_isready` | Yes |
| Processing queues | job metrics | Later |
| Scheduler health | worker heartbeat | Later |
| License / feature usage | `companies.settings.features` + counts | Later |

`/platform` is not only a company list — it is the operator control plane.

---

## Registration and onboarding

| Policy | Rule |
|--------|------|
| Public self-registration | **Disabled** (`RegisterPage` → `/login`) |
| Allowed flow | System owner → Create company → Create first admin → Email invite → Password setup |
| Anonymous company creation | **Forbidden** |

---

## Authentication evolution

| Phase | User experience | Implementation |
|-------|-----------------|----------------|
| **0 (now)** | Login via Traccar | Cookie → `authenticate` → `attachTenantContext` |
| **1** | NUMZFLEET returns full context on login | Extend `POST /api/auth/login` response |
| **2** | Login is NUMZFLEET | JWT from fuel-api; Traccar service account only |

**Frozen:** `authenticate` as strategy pattern (`traccar_session` | `numz_jwt`). Routes do not fork per strategy.

Long-term: users log into NUMZFLEET, not Traccar. Traccar becomes an internal telemetry service. Enables OAuth, MFA, API tokens without Traccar dependency.

---

## Audit strategy

### Today

- `operation_audit_events` — fuel-day domain only
- Console audit in event listeners — not platform-wide

### Target: `platform_audit_events`

| Field | Purpose |
|-------|---------|
| `actor_user_id` | Who |
| `active_context` | Context snapshot at time of action (always the actor's own home context — see v2.0 amendment) |
| `action` | e.g. `company.provisioned`, `vehicle.deleted` |
| `resource_type`, `resource_id` | What |
| `payload` | JSON detail |
| `ip`, `occurred_at` | Where, when |

**First events:** company provision, vehicle delete, fuel approve.

Module-level audit (operation sessions) remains; platform audit is additive.

---

## UI navigation hierarchy

```text
Every user's own fleet is primary — vehicles, fuel, maintenance, drivers,
trips, documents, all under their own home organization, no nesting.

Settings
  Platform (platformOwner only, jump-off point, not nested nav)
    /saas/platform/overview — health, Partners (read-only records), Direct Customers (read-only records)
  Business (partner-capability identities)
    /saas/partner/overview — My Customers (read-only records)
```

Partner/Customer entries are management records, never a nested "enter" path into another session — see [One organization per session (frozen)](#one-organization-per-session-frozen). Permissions and resource filters derive from `activeContext` + path + `resourceScope`; navigation *grouping* (Platform vs Business vs the user's own fleet) derives from route as well as `activeContext.type`, since a dual-capability identity's `activeContext.type` is always their home company's type, never `platform`.

### Frontend gap (today)

- [`store/organizations.js`](../traccar-fleet-system/frontend/src/store/organizations.js) holds `currentContext`/`homeCompanyId` from `GET /api/context` — this part of the original gap is closed.
- [`useSuperAdmin`](../traccar-fleet-system/frontend/src/common/util/permissions.js) still checks only the Traccar `administrator` flag; backend `isSuperAdmin` requires `administrator` **and** (no `numz_users.company_id` **or** an explicit `platform_super_admin` role grant). UI and API can still disagree for a dual-capability identity — this specific gap is not yet closed.

---

## NUMZ ecosystem extensibility

Fleet, Fuel, POS, Drive, Inventory, HR, and Accounting share the same platform layer: **Identity, Companies, ExecutionContext, Permissions, Resource ownership, Audit, Licensing, Notifications**.

- **Platform Services** are product-agnostic (provisioning, directory, health, audit).
- **Company Services** are product modules operating under company `activeContext`.
- New products add Company Services; they do not reimplement tenancy.

---

## Data isolation rules

1. Every **new** business table: `company_id NOT NULL` + FK — non-negotiable in code review.
2. Existing tables: covered by `20260616_multi_tenant_foundation.sql` and follow-on migrations.
3. **Traccar isolation:** per-company Traccar group via `company_devices` + `ensureDeviceInCompany` — parallel to Postgres, not a substitute.
4. **Module docs** (e.g. [VEHICLE_ODOMETER_STANDARD.md](VEHICLE_ODOMETER_STANDARD.md)) remain authoritative for domain rules but **consume** `ExecutionContext` for scope.

---

## Governance

1. **`docs/PLATFORM_ARCHITECTURE.md`** is authoritative for platform/tenancy concerns.
2. PRs touching auth, `tenantContext`, `numz_users`, `companies`, provisioning, `/platform` routes, or frontend context routing require explicit check against this spec.
3. Amendments require a **version bump** on this document.
4. Domain standards (odometer M1, operation sessions API, etc.) are not overridden here — they plug into company scope.

---

## Implementation phases (post-freeze)

Do not start until this document is approved.

| Phase | Deliverable |
|-------|-------------|
| 1 | Platform user provisioned (`company_id NULL`, `super_admin`) |
| 2 | `resolveExecutionContext` + `req.context` (parallel to `req.auth`) |
| 3 | `PlatformHealthService` + `/platform` API + UI |
| 4 | `ExecutionContext.applySequelizeWhere` in repositories (vehicles, sessions, fuel first) |
| 5 | Frontend context store + Platform/Company routing — **done, no switch banner**: `activeContext` is read-only per the v2.0 amendment, so there is nothing to bank a re-entry point on |
| 6 | Company Provisioning Engine + domain event contracts |
| 7 | Platform audit table + provisioning/deletion/approval events |
| 8 | Resource ownership filters (drivers first) |
| 9 | Auth strategy interface + JWT |

---

## Appendix: current implementation gaps

Honest mapping — code that contradicts this spec today:

| Gap | Location |
|-----|----------|
| Silent `DEFAULT_COMPANY_ID` fallback for unprovisioned users | `tenantResolverService.js` |
| `req.auth` not `ExecutionContext` | `tenantContext.js` |
| `listVehiclesMerged(companyId)` — single company only | `vehicleFleetService.js` |
| No `/api/platform/*` routes (SaaS platform routes live under `routes/organizations.js`, not a dedicated `/api/platform/*` namespace) | — |
| `useSuperAdmin` misaligned with backend | `permissions.js` vs `tenantResolverService.js` |
| `companies.status` free string | `Company` model |
| Audit operation-scoped only | `operation_audit_events` |
| No Platform / Company Services package boundary | — |
| No resource ownership layer beyond Traccar ACLs | — |
| No domain events for company provisioning | — |
| No platform health aggregation | — |

These gaps are **expected** until implementation phases begin. New code must move toward the target, not extend legacy patterns.

---

## Related documents

| Document | Role |
|----------|------|
| [fuel-api/docs/ACCOUNTS_AND_TENANCY.md](../fuel-api/docs/ACCOUNTS_AND_TENANCY.md) | Operational: request flow, troubleshooting |
| [fuel-api/docs/DATABASE_MIGRATIONS.md](../fuel-api/docs/DATABASE_MIGRATIONS.md) | Migration apply order |
| [VEHICLE_ODOMETER_STANDARD.md](VEHICLE_ODOMETER_STANDARD.md) | Domain: odometer (company-scoped consumer) |
| [deployment/MIGRATIONS_AND_DEPLOY.md](../deployment/MIGRATIONS_AND_DEPLOY.md) | Deploy + migrate |
