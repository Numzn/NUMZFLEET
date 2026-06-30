#!/usr/bin/env bash
# Apply all idempotent fuel-api Postgres migrations (canonical list: fuel-api/migrations/MIGRATION_ORDER).
#
# Usage (from repo root):
#   bash deployment/utils/run-fuel-migrations.sh
#   POSTGRES_CONTAINER=numzfleet-dev-db bash deployment/utils/run-fuel-migrations.sh
#   POSTGRES_CONTAINER=numzfleet-prod-db bash deployment/utils/run-fuel-migrations.sh
#
# Loads backend/.env for DATABASE_URL or POSTGRES_PASSWORD. Override POSTGRES_CONTAINER per environment.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"

MIGRATE_LOG_PREFIX="[run-fuel-migrations]"
# shellcheck source=deployment/utils/fuel-migrations-lib.sh
source "$SCRIPT_DIR/fuel-migrations-lib.sh"

[[ -f "$BACKEND_ENV" ]] || migrate_fail "Missing backend env: $BACKEND_ENV"

set -a
# shellcheck disable=SC1090,SC1091
source "$BACKEND_ENV"
set +a

verify_migration_db
run_all_fuel_migrations
