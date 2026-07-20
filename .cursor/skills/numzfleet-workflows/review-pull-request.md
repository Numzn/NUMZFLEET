# Review Pull Request

## When to use

- User asks for PR review, merge readiness check, or code review on NUMZFLEET changes.
- Before merging `develop` → `main` for production release.

## Review process

1. Read the full diff — not just the latest commit.
2. Check scope: focused change, no unrelated refactors.
3. Verify against governance docs when touching tenancy, auth, vehicle engine, or odometer.
4. Run or recommend targeted verification (not full `npm run build` unless user asked).

## Severity format

- **Critical** — must fix before merge (security, data loss, broken contract)
- **Suggestion** — should improve (maintainability, edge cases)
- **Nice to have** — optional polish

## Checklist

### Correctness

- [ ] Logic handles edge cases and error paths
- [ ] `company_id` / tenant scoping on new data access
- [ ] No parallel vehicle intelligence calculators (engine contract)
- [ ] Migrations idempotent and listed in `MIGRATION_ORDER`

### Security

- [ ] No secrets, `.env`, or credentials in diff
- [ ] Auth middleware on new routes
- [ ] Input validation on API boundaries
- [ ] No SQL injection / XSS vectors

### Style (from CONTRIBUTING)

- [ ] ESLint/Airbnb conventions (frontend)
- [ ] 2-space indent, meaningful names
- [ ] No `console.log` or debug leftovers
- [ ] Components: PascalCase; utilities: camelCase

### Ops / deploy

- [ ] If `fuel-api/migrations/` changed → deploy path must use `run-migrate-and-deploy.sh`
- [ ] No ad-hoc production compose build instructions
- [ ] Env vars documented in `.env.example` if new

### Docs

- [ ] User-facing changes reflected in README or `docs/`
- [ ] API changes noted in `fuel-api/docs/` when applicable
- [ ] CHANGELOG updated if project convention requires

### Tests

- [ ] Engine/service logic has tests where patterns exist
- [ ] Frontend: `npm test` in `traccar-fleet-system/frontend` if UI logic changed

## Platform governance triggers

Require explicit check against [docs/PLATFORM_ARCHITECTURE.md](../../../docs/PLATFORM_ARCHITECTURE.md) when PR touches:

- Authentication or execution context
- Company provisioning / `company_id`
- Cross-tenant data access
- Platform navigation or permissions
- Feature flags affecting tenancy

Deviations need a doc version bump — not silent code drift.

## Commit message style

Conventional commits: `feat(scope): subject`, `fix(scope): subject`, etc.

## Tools

For automated deep review, user can invoke built-in **Bugbot** or **security-review** skills on the diff.

## Merge flow reminder

`develop` → PR → `main` → CI build/push images → production deploy by SHA.
