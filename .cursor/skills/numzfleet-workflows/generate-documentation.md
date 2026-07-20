# Generate Documentation

## When to use

- User asks to document a feature, API, migration, or architecture decision.
- PR requires docs updates.
- Creating runbooks for operators.

## Principles

- **Only write docs when asked** — don't proactively create markdown files.
- Match existing doc tone: operational, precise, tables for reference data.
- Link to authoritative sources rather than duplicating frozen specs.

## Doc locations

| Type | Path |
|------|------|
| Platform / governance | `docs/PLATFORM_ARCHITECTURE.md` (frozen — version bump on change) |
| Development / NumzLab | `docs/DEVELOPMENT.md` |
| Deploy / release | `docs/RELEASE_PIPELINE_V3.md`, `deployment/*.md` |
| Fuel API | `fuel-api/docs/` |
| Vehicle odometer | `docs/VEHICLE_ODOMETER_*.md` |
| Migrations | `fuel-api/docs/DATABASE_MIGRATIONS.md` |
| Contributing | `CONTRIBUTING.md`, `README.md` |

## Templates

### Feature doc (fuel-api)

```markdown
# [Feature Name]

## Purpose
One paragraph: what problem this solves.

## Data model
Tables/columns or API resources affected.

## API
Method, path, auth, request/response shapes.

## Configuration
Env vars with defaults.

## Troubleshooting
Common errors and fixes.
```

### Migration note

Add to `fuel-api/docs/DATABASE_MIGRATIONS.md` section — include:

- Filename and what it adds
- Idempotency notes
- Verify commands (`psql`, `\d table`)

### Architecture amendment

1. Bump version in `docs/PLATFORM_ARCHITECTURE.md` header.
2. Describe change in amendment section.
3. Update operational supplement `fuel-api/docs/ACCOUNTS_AND_TENANCY.md` if request flow changes.

## Code comments

- JSDoc on new public functions/endpoints.
- Comments for non-obvious business rules only — not narration.

## What not to document in repo

- Secrets, production passwords, personal Tailscale IPs (use placeholders).
- Duplicate content already in frozen architecture docs.

## Verify links

Use relative paths from doc location. Test that linked files exist before finishing.
