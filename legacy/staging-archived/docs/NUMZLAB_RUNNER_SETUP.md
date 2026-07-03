# NumzLab Self-Hosted GitHub Runner Setup

This guide installs a self-hosted runner on NumzLab for staging deployment workflows.

## Target host and labels

- Host: `numzlab` (`100.121.79.2`)
- Repo path: `/srv/projects/numzfleet`
- Suggested runner labels:
  - `self-hosted`
  - `numzlab`
  - `staging`

## 1) Create runner user (optional but recommended)

```bash
sudo useradd -m -s /bin/bash github-runner || true
sudo usermod -aG docker github-runner
```

If you use existing user `numz14`, ensure it is in the `docker` group.

## 2) Download and configure runner

From GitHub repo settings:

- `Settings` -> `Actions` -> `Runners` -> `New self-hosted runner` -> Linux x64

Run the generated commands on NumzLab (as runner user), then:

```bash
./config.sh --labels "numzlab,staging"
```

## 3) Install as service

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

## 4) Required host access

Runner user must have access to:

- `/srv/projects/numzfleet`
- `/srv/projects/numzfleet/deployment/.env.staging`
- `/srv/projects/numzfleet/backend/.env`
- Docker socket via `docker` group

## 5) Validation

Trigger `.github/workflows/runner-smoke.yml` and confirm:

- Runner picked up job on NumzLab
- `docker ps` runs successfully
- `/srv/projects/numzfleet` exists and is writable

## 6) Operational notes

- Keep runner service active after reboot.
- Rotate runner registration token periodically by reconfiguring the runner.
- Keep GitHub Actions runner binary updated as recommended by GitHub.
- Do not store production SSH keys on this runner.
