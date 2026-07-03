# NUMZFLEET Release Pipeline v3

This document defines the release model for staging and production.

## Environment roles

- `develop` deploys to NumzLab staging.
- `main` deploys to OCI production.
- Docker Hub is the only image registry for deployments.

## Artifact rule

- CI builds and pushes immutable SHA tags: `numz14/numzfleet-*: <40-char-sha>`.
- Promotion to OCI must deploy the exact SHA that already passed staging.
- OCI never builds images locally.

## Merge and promotion rule

- Feature branches merge into `develop` with squash merge.
- Production promotion is done by promoting a validated SHA.
- `main` is a release pointer and must be fast-forwarded to the promoted SHA.
- Do not squash merge `develop` into `main` for releases.

## Branch protection (GitHub settings)

Set these in repository settings:

### `develop`

- Require pull request before merging.
- Allow squash merge for feature PRs.

### `main`

- Require pull request before merging (or restrict direct push to release bot/admins).
- Require manual production approval in GitHub Environment `production`.
- Only fast-forward updates to promoted SHA.

## Promotion gate

OCI deploy is allowed only when all checks pass:

1. Staging deployment succeeded for the same SHA.
2. Docker Hub manifests exist for frontend, backend, and ERB with that SHA tag.
3. Manual production approval is granted.

If any check fails, OCI deployment must not run.

## Deployment workflows

### Staging (`develop`)

1. Push to `develop`.
2. GitHub Actions builds and pushes image tags for the commit SHA.
3. Staging workflow verifies manifests and deploys to NumzLab.
4. Smoke checks pass (`backend`, `frontend`, `traccar`).
5. A staging deployment record is written for promotion gate use.

### Production promotion

1. Trigger `promote-to-production` workflow with `promoted_sha`.
2. Approve production environment manually.
3. Gate validates staging success + Docker Hub manifests for the same SHA.
4. OCI deploy runs pull-only promotion (`promote-to-production.sh`).
5. Baseline backup is created for the promoted SHA.
6. `main` is fast-forwarded to the promoted SHA.

## Rollback procedures

### Staging rollback (NumzLab)

Use SHA history tracked in `.staging_deploy_history`:

```bash
bash deployment/deploy/rollback-staging.sh deployment/.env.staging
```

This redeploys the previous staging SHA from Docker Hub (no local build).

### Production rollback (OCI)

Use SHA history tracked in `.deploy_history`:

```bash
bash deployment/deploy/rollback.sh deployment/.env
```

This redeploys the previous production SHA from Docker Hub (no local build).

### Database rollback note

Application rollback does not automatically revert schema/data changes. If needed:

1. Restore matching baseline backup from `deployment/backup/`.
2. Re-deploy the known-good previous SHA.
3. Re-run health checks (`/health`, `/api/health`, Traccar checks).

## Initial setup checklist (one-time)

Complete these before the first v3 staging deploy:

1. **Create and push `develop`** from current `main` if it does not exist on GitHub:
   ```bash
   git checkout main && git pull
   git checkout -B develop
   git push -u origin develop
   ```
2. **Branch protection** (GitHub → Settings → Branches): apply rules in the section above for `develop` and `main`.
3. **GitHub Environment `production`**: add required reviewers for manual promotion approval.
4. **Repository secrets**: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `OCI_SSH_HOST`, `OCI_SSH_USER`, `OCI_SSH_KEY`, `NUMZFLEET_RELEASE_BOT_TOKEN` (PAT with `contents: write` for FF `main`).
5. **Repository variable** (optional): `VITE_API_BASE_URL` for staging frontend builds (default Tailscale URL in workflow).
6. **NumzLab self-hosted runner**: install per [NUMZLAB_RUNNER_SETUP.md](NUMZLAB_RUNNER_SETUP.md); validate with `runner-smoke.yml`.
7. **NumzLab registry cutover**: follow [NUMZLAB_DEPLOYMENT.md](NUMZLAB_DEPLOYMENT.md) one-time cutover section.

## End-to-end validation drills (M9)

Run once after v3 rollout. Record dates and SHA values in your ops log.

| # | Drill | Steps | Expected result |
|---|-------|-------|-----------------|
| 1 | Staging auto-deploy | Push a trivial change to `develop` (or `workflow_dispatch` deploy-staging with a built SHA) | Build workflow pushes three Docker Hub SHA tags; deploy-staging succeeds; staging GitHub Deployment `success`; smoke passes on `:3000`, `:8082`, `:3003` |
| 2 | Failed promotion gate | Trigger `promote-to-production` with a SHA that was **not** deployed to staging | Gate job fails: no successful staging deployment and/or missing manifests |
| 3 | Successful promotion | Trigger `promote-to-production` with the staging-validated SHA; approve `production` | OCI pulls same SHA (no build); `https://numz.site/health` and `/api/health` pass; baseline backup created; `main` FF to promoted SHA |
| 4 | Production rollback | On OCI: `bash deployment/deploy/rollback.sh deployment/.env` | Previous SHA from `.deploy_history` redeploys; containers healthy; GPS ports unchanged |
| 5 | Staging rollback | On NumzLab: `bash deployment/deploy/rollback-staging.sh deployment/.env.staging` | Previous staging SHA redeploys from Docker Hub |
| 6 | OCI unchanged audit | After drills 1–4, confirm OCI Traccar/GPS still accepting device traffic | No unexpected downtime on production GPS during staging-only drills |

**Drill 2 command example:**

```bash
# Pick any 40-char SHA that never passed staging deploy
gh workflow run promote-to-production.yml -f promoted_sha=<untested-sha>
# Expect gate job failure before OCI SSH runs
```

**Drill 3 command example:**

```bash
gh workflow run promote-to-production.yml -f promoted_sha=<staging-validated-sha>
```

## Related docs

- [NUMZLAB_DEPLOYMENT.md](NUMZLAB_DEPLOYMENT.md) — staging host setup and cutover
- [NUMZLAB_RUNNER_SETUP.md](NUMZLAB_RUNNER_SETUP.md) — self-hosted runner install
- [deployment/REGISTRY_DEPLOY.md](../deployment/REGISTRY_DEPLOY.md) — operator commands and legacy reference
