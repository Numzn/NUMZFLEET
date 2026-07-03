#!/usr/bin/env bash
# Wrapper for cron: load machine-local env, then run backup.sh (same directory).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${BACKUP_ENV_FILE:-${SCRIPT_DIR}/backup.env}"

umask 077

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
else
  echo "WARN: ${ENV_FILE} not found; using backup.sh defaults (COMPOSE_DIR, SECRETS_FILE, S3_*)" >&2
fi

mkdir -p "${BACKUP_ROOT:-/home/ubuntu/backups}/logs"

exec "${SCRIPT_DIR}/backup.sh"
