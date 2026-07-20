# Architecture Review

## When to use

- Evaluating design proposals for tenancy, auth, vehicle engine, or cross-module boundaries.
- Reviewing PRs that change platform behavior.
- Planning new modules (fuel, maintenance, fleet, notifications).

## Authoritative references

| Document | Scope |
|----------|-------|
| [docs/PLATFORM_ARCHITECTURE.md](../../../docs/PLATFORM_ARCHITECTURE.md) | Frozen v1 — identity, tenancy, context, permissions, governance |
| [fuel-api/docs/ACCOUNTS_AND_TENANCY.md](../../../fuel-api/docs/ACCOUNTS_AND_TENANCY.md) | Operational request flow, env vars, troubleshooting |
| [fuel-api/src/vehicleEngine/CONTRACT.md](../../../fuel-api/src/vehicleEngine/CONTRACT.md) | Vehicle read model, module write ownership |
| [docs/VEHICLE_ODOMETER_STANDARD.md](../../../docs/VEHICLE_ODOMETER_STANDARD.md) | Odometer business language (frozen) |

**Governance:** PRs changing tenancy, auth, permissions, provisioning, or platform navigation must align with PLATFORM_ARCHITECTURE. Deviations require a **version bump** in that doc.

## Layer model

```text
Authentication (Traccar today → JWT later)
    ↓
Execution Context (fuel-api middleware: user, company, permissions)
    ↓
Business data (PostgreSQL, company_id on rows)
    ↓
Telemetry (Traccar — what device reported)
    ↓
Product modules (Fleet, Fuel, Maintenance, Vehicle Engine)
```

**Core rule:** Platform is not a company. No `Company` row for platform.

## Review questions

### Tenancy

- Does every new table/API row have `company_id` scoping?
- Can this query leak cross-tenant data?
- Is context resolved in middleware, not ad-hoc per route?

### Service boundaries

- Does the module **own its writes**?
- Does UI/API **read intelligence** from Vehicle Engine instead of recomputing?
- Is Traccar treated as telemetry source, not business logic owner?

### Auth evolution

- Code should not hardcode Traccar-session assumptions that block future JWT path.
- Permissions checked via execution context, not duplicated role logic.

### Data flow

- Telemetry: device → Traccar → normalize → hubs
- Operations: module writes → engine aggregates → UI consumes engine
- Notifications: see `fuel-api/docs/NOTIFICATIONS_VALIDATION.md`

## Anti-patterns (flag in review)

| Anti-pattern | Why |
|--------------|-----|
| Parallel KPI endpoint per module | Violates engine contract |
| Frontend odometer/fuel efficiency math | Engine owns calculations |
| `company_id` optional on new tables | Breaks multi-tenant foundation |
| Sequelize sync instead of SQL migration | Production schema drift |
| `docker compose build` on OCI | Registry deploy contract |
| Platform as a fake company row | Violates platform positioning |

## Review output format

```markdown
## Architecture review: [topic]

### Alignment
[Aligned / Partial / Conflicts with PLATFORM_ARCHITECTURE §X]

### Boundaries
[Which module owns writes vs reads]

### Risks
- [Risk + mitigation]

### Required follow-ups
- [ ] Doc version bump (if governance change)
- [ ] Migration in MIGRATION_ORDER (if schema)
- [ ] Engine contract update (if vehicle intelligence)
```

## When to escalate

- Cross-product platform changes (beyond fleet/fuel scope)
- Auth model changes
- Breaking tenancy or permission model
- New external integration affecting all tenants
