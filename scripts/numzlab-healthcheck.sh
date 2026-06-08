#!/usr/bin/env bash
# NumzLab staging health checks (Release Pipeline v3). Run from repo root on NumzLab.
set -euo pipefail

STAGING_COMPOSE="deployment/compose/docker-compose.staging.yml"
STAGING_ENV="deployment/.env.staging"
COMPOSE_ARGS=(-f "$STAGING_COMPOSE" --env-file "$STAGING_ENV")
compose() { docker compose "${COMPOSE_ARGS[@]}" "$@"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail=0
ok() { printf '  OK  %s\n' "$1"; }
bad() { printf '  FAIL %s\n' "$1"; fail=1; }

echo "== NumzLab healthcheck =="
echo "Repo: $ROOT"
echo "Compose: $STAGING_COMPOSE"
echo

echo "[1] Compose services"
if ! compose ps --status running 2>/dev/null | grep -qE 'backend|traccar|db'; then
  bad "expected staging services not running — run: bash deployment/deploy/deploy-to-staging.sh <sha> $STAGING_ENV"
else
  compose ps
  ok "compose ps"
fi
echo

echo "[2] fuel-api"
if curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
  ok "GET :3000/health"
else
  bad "GET :3000/health"
fi

echo "[3] Traccar HTTP"
code="$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:8082/ 2>/dev/null || echo 000)"
if [[ "$code" == "200" ]]; then
  ok "GET :8082/ ($code)"
else
  bad "GET :8082/ ($code)"
fi

echo "[4] PostgreSQL"
if compose exec -T db pg_isready -U numztrak -d numztrak_fuel >/dev/null 2>&1; then
  ok "pg_isready numztrak_fuel"
else
  bad "pg_isready numztrak_fuel"
fi

echo "[5] Traccar MySQL"
if compose exec -T traccar-mysql mysqladmin ping -h localhost >/dev/null 2>&1; then
  ok "mysqladmin ping"
else
  bad "mysqladmin ping"
fi

echo "[6] ERB API"
if compose exec -T erb-api python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/v1/health')" >/dev/null 2>&1; then
  ok "erb-api /v1/health"
else
  bad "erb-api /v1/health"
fi

echo "[7] frontend"
if curl -sf http://127.0.0.1:3003/health >/dev/null 2>&1; then
  ok "GET :3003/health"
else
  bad "GET :3003/health"
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "All required checks passed."
  exit 0
fi
echo "One or more checks failed."
exit 1
