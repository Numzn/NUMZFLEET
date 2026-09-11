# NUMZFLEET Tenancy Architecture

**Status:** Authoritative v1.0
**Scope:** Tenant isolation, company scoping, authorization, customer roles, resource ownership, Traccar tenancy boundaries
**Does not cover:** Platform product positioning, UI navigation, provisioning workflow, audit strategy — see [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md)
**Applies to:** All work touching authorization, company scoping, resource ownership, real-time delivery, or any path that reaches Traccar

**Governance:** This document is authoritative for everything in Scope above. Where it and [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md) both speak to tenancy or authorization, **this document wins**. Pull requests that change authorization, company scoping, resource ownership, Traccar access, or real-time delivery must be reviewed against this specification. Deviations require a version bump and amendment here — not silent drift in code.

**Origin:** Written after the September 2026 cross-company visibility incident and the independent architecture review that followed it. The review found that fuel-api's company model and Traccar's own ACL were operating as two independent authorization systems, and that the browser could reach Traccar's native API directly for most of the application.

---

## 1. The invariant

> **No customer-company user may view, access, modify, delete, command, control, or otherwise operate on any resource belonging to another company.**

This holds regardless of Traccar ACL state, Traccar group membership, Traccar device grants, stale permissions, frontend behaviour, WebSocket behaviour, direct HTTP requests, browser DevTools, cached client state, reconnects, administrator-looking customer roles, or any future feature or integration.

Two consequences follow, and neither is negotiable:

1. **Enforcement is server-side, in fuel-api.** Frontend filtering is a UX affordance, never a security control.
2. **Enforcement is independent of Traccar.** If Traccar's ACL is wrong, absent, stale, or unreachable, the invariant must still hold.

---

## 2. Ownership model

Company is the primary tenancy boundary, and PostgreSQL is its only source of truth.

```
numz_users.company_id          →  which company a user belongs to
vehicles.company_id            →  which company owns a vehicle   (NOT NULL)
device_assignments.vehicle_id  →  which vehicle a device serves   (active row only)
device_assignments.device_id   →  Traccar tc_devices.id           (cross-database, not an FK)
```

**Traccar groups, `tc_user_group`, `tc_user_device`, and the Traccar `administrator` flag are never inputs to a NUMZFLEET ownership decision.** They may exist for Traccar's own operability (see §8) but they do not define ownership.

### Company scope per resource

| Resource | Chain to company |
|----------|------------------|
| Vehicle | `vehicles.company_id` |
| Device | active `device_assignments` → `vehicles.company_id` |
| Position / Event / Trip / Replay | Traccar `deviceid` → device chain above |
| Report | every device id in the request → device chain above |
| Maintenance, fuel record, operation session | owning `company_id` column |
| Notification, preference, push subscription | owning `company_id` column |
| Geofence | **no ownership model yet** — see §9 |
| Driver, calendar, computed attribute, saved command | **no ownership model yet** — see §9 |

A resource with no reliable company relationship must not be guessed at. Until it has an explicit ownership model, it is treated as un-authorizable and must not be exposed through a company-scoped endpoint.

---

## 3. Authorization

### Where the decision happens

```
Browser → nginx (/api, /socket.io) → fuel-api
                                        ├── 1 Authentication        who is this?
                                        ├── 2 ExecutionContext      company + permissions + scope
                                        ├── 3 Authorization         may they do this, to this?
                                        ├── 4 Service layer         company-scoped repositories
                                        └── 5 TraccarGateway        only reached after 3 allowed
                                                ↓
                                      PostgreSQL  +  Traccar
```

The browser never participates in the decision, and never reaches Traccar directly (§7).

### The two checks

`authorize(ctx, action, resource)` denies by default and requires **both** of the following to pass independently:

| Check | Question | Source |
|-------|----------|--------|
| **Tenant** | Is the resource's company within this identity's accessible companies? | `scopeValidationService.getAccessibleCompanyIds()` |
| **Permission** | Does this identity hold the permission this action requires? | `rolesService.resolvePermissionsForNumzUser()` |

Tenancy and capability are orthogonal and must stay that way. A Company Admin holds broad permissions **inside their own company only**. Collapsing the two into a single "admin" concept is precisely how cross-company access has previously leaked.

### Deny is silent toward Traccar

A denied request returns 403 and **Traccar is never contacted**. Authorization is not an after-the-fact filter on a response; it is a gate in front of the call.

---

## 4. Roles

RBAC lives in PostgreSQL: `permissions` → `role_permissions` → `roles` → `user_roles`.

### Company-scoped vs platform-scoped

The distinction is carried by `user_roles.company_id`, and it is structural rather than conventional:

| Identity | Expressed as | Crosses companies? |
|----------|--------------|--------------------|
| Customer company admin — e.g. "I-TRACK Administrator" | `user_roles(role_id = company_admin, company_id = <I-TRACK>)` | **No.** The assignment itself is scoped to one company. |
| Platform administrator | `user_roles(role_id = platform_super_admin, company_id = NULL)` | **Yes** — the only identity that may. |
| Traccar `administrator` flag | Traccar-internal only | **Never an input to NUMZFLEET authorization.** |

A `NULL` company on a role assignment is the *only* expression of platform scope. There is no other mechanism, and no flag on any external system may substitute for it.

### Action catalogue

| Action | Permission key |
|--------|----------------|
| VIEW_VEHICLE / EDIT_VEHICLE | `fleet.vehicles.read` / `fleet.vehicles.manage` |
| VIEW_POSITION | `telemetry.positions.read` |
| VIEW_EVENT | `telemetry.events.read` |
| VIEW_TRIP / REPLAY | `telemetry.history.read` |
| VIEW_REPORT | `reports.traccar.read` |
| VIEW_GEOFENCE / EDIT_GEOFENCE | `fleet.geofences.read` / `fleet.geofences.manage` |
| SEND_COMMAND | `fleet.devices.command` |
| IMMOBILIZE_VEHICLE | `fleet.vehicles.immobilize` |
| MANAGE_DEVICE | `integrations.devices.manage` |
| MANAGE_USERS | `organization.members.manage` |
| MANAGE_DRIVERS | `fleet.drivers.manage` |
| MANAGE_COMPANIES | `platform.companies.manage` |

Immobilization holds a **separate permission** from general command dispatch. Remotely cutting an engine differs in kind from sending a configuration command, and must be independently grantable and independently auditable.

---

## 5. Traccar's role

| NUMZFLEET owns | Traccar owns |
|----------------|--------------|
| Companies, users, company membership | GPS communication and protocol handling |
| Vehicle ownership | Device connectivity |
| Application roles and business permissions | Positions and telemetry |
| Tenant isolation | Device events |
| Business workflows | Device command execution |
| Customer-facing authorization | — |

Traccar is an internal telemetry and device-execution engine. It is not an authorization system, not a source of ownership, and not a customer-facing surface.

---

## 6. Backend identities

fuel-api reaches Traccar through dedicated, non-human integration identities. These exist so that fuel-api can talk to Traccar at all — **they never determine customer authorization.**

| | `numzfleet-system-runtime` | `numzfleet-system-provisioner` |
|---|---|---|
| Traccar privilege | Non-admin; member of each company group | `administrator` |
| Used for | Command dispatch, runtime REST reads | Company/user/group provisioning, ACL reconciliation |
| Frequency | Every command request | Rare — provisioning and reconcile runs |
| Blast radius if leaked | Device commands | Full Traccar administration |

Minimum privilege was established empirically, not assumed:

- `POST`/`DELETE /api/permissions` requires `administrator` — granting a permission to *another* user has no lesser form in Traccar's model.
- `POST /api/commands/send` requires only **device access**, which group membership satisfies. Administrator is not required for the high-frequency path.
- Telemetry reads bypass Traccar's permission layer entirely (direct MySQL), requiring no Traccar identity at all.

A backend identity must never be a human account, never belong to a customer company, never be used by the frontend, never be used for interactive login, and never be tied to a developer's personal account.

### Non-inheritance

> A customer request must pass NUMZFLEET authorization **before** fuel-api uses a backend identity. The backend identity's reach is never inherited by the requester.

This is enforced structurally rather than by convention. `TraccarGateway` methods that act on a device accept only an `AuthorizedDeviceRef` — a value object the authorization layer alone can construct:

```js
// only authorize() returns this; there is no public constructor
const ref = await authorize(ctx, SEND_COMMAND, { deviceId });  // throws 403 on mismatch
await traccarGateway.sendCommand(ref, command);                // uncallable without one
```

A controller holding a raw `deviceId` from a request body has nothing the gateway will accept.

---

## 7. Browser access and real-time delivery

### fuel-api is the only application gateway

The browser talks to `/api/*` and `/socket.io` only. Direct browser access to `/traccar/*` is **to be removed** once every dependent surface is migrated; until then it is a known, tracked exposure, not an accepted design.

### Real-time tenancy is server-side

Live data reaches the browser over **fuel-api's own Socket.IO**, never Traccar's WebSocket. Room membership is assigned by the server from the identity's resolved company and is never requested by the client.

| Room | Membership |
|------|------------|
| `managers:<companyId>` | Managers of that company only |
| `managers:platform` | Platform-scoped identities |
| `user-<userId>` / `driver-<userId>` | The individual identity |

Client-side filtering may remain as a redundant second layer, but it is never the control. A malicious client that connects directly, replays a handshake, or manipulates messages must still receive nothing outside its own company.

---

## 8. Traccar ACL: defense in depth, not the boundary

Traccar's own ACL (groups, `tc_user_group`, `tc_user_device`, `administrator`) is retained for Traccar's native operability and as a redundant second layer. It is **not** the NUMZFLEET tenancy boundary.

The operative requirement: **an ACL synchronization failure must never become a cross-company data leak.** Because NUMZFLEET's decisions never consult Traccar's ACL, a sync failure degrades Traccar-native operability only — it cannot widen NUMZFLEET access.

Sync failures must be observable rather than silent. Attempts, successes, failures, timestamps and a safe failure category are surfaced through the existing health mechanism. A non-critical ACL sync failure must not mark the whole application unhealthy.

---

## 9. Known gaps

Honest mapping of what does not yet satisfy this document. New code must move toward the target, never extend the legacy pattern.

| Gap | Location |
|-----|----------|
| Traccar `administrator`/`isManager` still derive NUMZFLEET roles | `authGates.js`, `tenantResolverService.js` |
| Unprovisioned identity silently receives `DEFAULT_COMPANY_ID` | `tenantResolverService.js` |
| RBAC tables populated but not the decision source | `rolesService.js` |
| Browser reaches Traccar directly (52 endpoints, ~180 call sites) | `nginx.conf`, frontend `traccarFetch` callers |
| Browser can call Traccar's own `/api/permissions`, `/api/users`, `/api/server/reboot` | frontend settings pages |
| Live positions/events still arrive over Traccar's WebSocket | `SocketController.jsx` |
| Geofences, drivers, calendars, computed attributes have no company ownership | — |
| `device_assignments` has no `company_id`; cross-company assignment is structurally representable | `DeviceAssignment.js` |
| Authorization caches are per-process and will go stale across instances | `rolesService.js`, `tenantResolverService.js` |
| Traccar access scattered across three clients | `config/traccar.js`, `traccarServiceClient.js`, `traccarCommandService.js` |

---

## 10. Migration

Twelve phases, each independently shippable and reversible. Only Phase 11 removes a capability; everything before it is additive.

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Observability, Traccar version pinning, company-scoped manager rooms | **Done** |
| 2 | Dedicated runtime + provisioner identities | Pending |
| 3 | Restore command dispatch through the runtime identity | Pending |
| 4 | ExecutionContext + policy engine; RBAC becomes the decision source | Pending |
| 5 | Freeze the direct-Traccar surface (CI guard) | Pending |
| 6 | Geofences: ownership model + endpoints | Pending |
| 7 | Reports | Pending |
| 8 | Replay, history, events, media | Pending |
| 9 | Remaining Traccar-sensitive surface | Pending |
| 10 | Server-side WebSocket telemetry | Pending |
| 11 | Remove browser access to `/traccar/*` | Pending |
| 12 | Demote Traccar ACL to secondary defence | Pending |

Phase 11 has a hard prerequisite: the session family (login, token login, OpenID, password reset, TOTP) must be re-homed onto fuel-api first.

---

## 11. Required tests

Tenancy tests run in CI **without** a live Traccar. That constraint is deliberate: it forces the tenancy decision to be provably independent of Traccar.

**Core matrix** — for every resource (vehicle, device, position, event, trip, report, replay, geofence, driver, maintenance, fuel operation, operation session, notification, media):

| Actor | Resource owner | Expected |
|-------|----------------|----------|
| Company A user/admin | Company A | Allow, subject to permission |
| Company A user/admin | Company B | **Deny 403** |
| Company B admin | Company A | **Deny 403** |
| Platform admin | Either | Per explicit policy |
| Unprovisioned identity | Any | **Deny** |
| Anonymous | Any | **401** |

**Traccar-divergence scenarios:**

| Scenario | Expected |
|----------|----------|
| Traccar ACL over-grants another company | Denied on every surface, including realtime |
| Traccar ACL grants nothing | Authorized NUMZFLEET operations still work |
| ACL sync unavailable | No cross-company leak; failure visible on `/health` |
| Stale `tc_user_device` row for another company | No effect on any NUMZFLEET decision |

**Bypass tests** must run outside the browser: `curl` against every cross-company resource id, tampered `deviceId`/`vehicleId`/`companyId` in body, query and path, a raw WebSocket client attempting another company's room, and a session replayed after a role or company change.

---

## Related documents

| Document | Role |
|----------|------|
| [PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md) | Platform positioning, context model, navigation, provisioning, audit |
| [fuel-api/docs/ACCOUNTS_AND_TENANCY.md](../fuel-api/docs/ACCOUNTS_AND_TENANCY.md) | Operational: request flow, env vars, troubleshooting |
| [fuel-api/docs/DATABASE_MIGRATIONS.md](../fuel-api/docs/DATABASE_MIGRATIONS.md) | Migration apply order |
| [deployment/MIGRATIONS_AND_DEPLOY.md](../deployment/MIGRATIONS_AND_DEPLOY.md) | Deploy + migrate |
