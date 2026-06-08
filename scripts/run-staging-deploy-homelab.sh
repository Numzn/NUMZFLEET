#!/usr/bin/env bash
# One-shot: docker login + v3 staging deploy on NumzLab via ssh homelab.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHA="${1:-237ee3d61158da999044cc9356b30a62f4216fef}"
RCC_ENV="$ROOT/release-control-center/config/rcc.env"

if [[ ! -f "$RCC_ENV" ]]; then
  echo "Missing $RCC_ENV (DOCKERHUB_TOKEN required)" >&2
  exit 1
fi

TOKEN="$(grep '^DOCKERHUB_TOKEN=' "$RCC_ENV" | cut -d= -f2- | tr -d '\r\n')"
if [[ -z "$TOKEN" ]]; then
  echo "DOCKERHUB_TOKEN not set in $RCC_ENV" >&2
  exit 1
fi

echo "== Docker Hub login on homelab =="
printf '%s' "$TOKEN" | ssh homelab "docker login -u numz14 --password-stdin"

echo "== Staging deploy SHA=$SHA =="
ssh homelab "set -euo pipefail
cd /srv/projects/numzfleet
git fetch origin develop
git checkout '$SHA'
docker pull numz14/numzfleet-frontend:'$SHA'
bash deployment/deploy/deploy-to-staging.sh '$SHA' deployment/.env.staging
bash deployment/verify/staging-smoke.sh
echo 'Recorded staging SHA:'
cat deployment/deploy/.last_staging_deploy
"

echo "== Done =="
