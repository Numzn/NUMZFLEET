# Deployment

**Start here:** [DEPLOYMENT_FLOW.md](./DEPLOYMENT_FLOW.md) — authoritative runbook (full-stack vs registry, rollback, hybrid checklist).

## Entry points (summary)

| What | Command / path |
|------|------------------|
| **Production full stack (default)** | `.\release-prod.ps1` from repo root (Windows) |
| **Production fast path (pulled images)** | `.\release-prod.ps1 -UseRegistryAppImages -RegistryImagePrefix "user-or-ghcr-path" -SkipLocalChecks` after `.\deploy-registry.ps1 -Action BuildPush` |
| **Registry images — build/push (Windows)** | `.\deploy-registry.ps1` — `-Action Build`, `Push`, `BuildPush`, or `Validate` |
| **Registry — shell scripts** | `deployment/build/`, `deployment/push/`, `deployment/deploy/` (use **Git Bash**, not Store `bash`) |
| **Frontend-only rsync-style** | `./deploy-frontend-docker.sh` (Git Bash from repo root) |
| **OCI machine bootstrap** | `deployment/oci-server-setup.sh` |

## Legacy (do not use for current prod)

- `deployment/oci-deploy.sh`, `backend/deploy.sh`, `deploy.sh` (removed)
- `deployment/deploy-backend-only-final.sh` (removed)

## More docs

- Root `README.md` — project overview; Docker section links to `DEPLOYMENT_FLOW.md`
- `ROUTING.md` — same-origin routing
- `fuel-api/docs/DATABASE_MIGRATIONS.md` — database migrations
