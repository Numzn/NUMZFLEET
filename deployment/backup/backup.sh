#!/usr/bin/env bash
# NUMZFLEET — logical backup: Postgres + Traccar MySQL + optional ERB volume.
# Docker Compose v2 only; uses service names (db, traccar-mysql), not container names.
# Production must match `docker compose up` (see COMPOSE_PROJECT_NAME, COMPOSE_ARGS_OVERRIDE).
set -euo pipefail

umask 077

# --- defaults (override via environment or backup.env wrapper) ---
COMPOSE_DIR="${COMPOSE_DIR:-/home/ubuntu/NUMZFLEET}"
# Set to the same value as production if you use: docker compose -p <name> up
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/ubuntu/backups}"
SECRETS_FILE="${SECRETS_FILE:-${COMPOSE_DIR}/backup-secrets.env}"

# Space-separated flags (must match how production was started; no spaces in paths)
if [[ -n "${COMPOSE_ARGS_OVERRIDE:-}" ]]; then
  read -r -a COMPOSE_ARGS <<< "${COMPOSE_ARGS_OVERRIDE}"
else
  COMPOSE_ARGS=(-f deployment/compose/docker-compose.prod.yml)
fi

RETENTION_DAYS="${RETENTION_DAYS:-14}"
MIN_DUMP_BYTES="${MIN_DUMP_BYTES:-4096}"
# Named volume from docker-compose.prod.yml (override if compose volume name changes)
ERB_VOLUME_NAME="${ERB_VOLUME_NAME:-numzfleet_prod_erb_data}"

DISABLE_S3_UPLOAD="${DISABLE_S3_UPLOAD:-0}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-numzfleet/backups}"

# Google Drive via rclone (optional; uses same Linux user as cron — ~/.config/rclone/)
DRIVE_ENABLED="${DRIVE_ENABLED:-0}"
DRIVE_REMOTE="${DRIVE_REMOTE:-gdrive}"
DRIVE_PATH="${DRIVE_PATH:-}"
DRIVE_RETENTION_DAYS="${DRIVE_RETENTION_DAYS:-}"

# Optional: POST a minimal JSON on failure (no secrets in body)
BACKUP_WEBHOOK_URL="${BACKUP_WEBHOOK_URL:-}"

TS="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
HOST="$(hostname -s 2>/dev/null || echo unknown)"
RUN_DIR="${BACKUP_ROOT}/run/${HOST}_${TS}"
STAGING="${RUN_DIR}/staging"
LOG_FILE="${RUN_DIR}/backup.log"
ARCHIVE_NAME="numzfleet_backup.tar.gz"
ARCHIVE_PATH="${RUN_DIR}/${ARCHIVE_NAME}"
CHECKSUM_PATH="${ARCHIVE_PATH}.sha256"

NOTIFIED=0
notify_webhook() {
  [[ -n "${BACKUP_WEBHOOK_URL}" ]] || return 0
  [[ "${NOTIFIED}" -eq 1 ]] && return 0
  NOTIFIED=1
  local msg='NUMZFLEET backup failed'
  if ! curl -fsS -X POST -H 'Content-Type: application/json' \
    -d "{\"text\":\"${msg}\",\"host\":\"${HOST}\",\"ts\":\"${TS}\"}" \
    "${BACKUP_WEBHOOK_URL}" >/dev/null 2>&1; then
    printf '%s %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "WARN: webhook delivery failed (${BACKUP_WEBHOOK_URL})" >&2
  fi
}

log() { printf '%s %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"; }

warn_if_crlf_line_endings() {
  local script_path="${BASH_SOURCE[0]}"
  [[ -r "${script_path}" ]] || return 0
  if LC_ALL=C grep -q $'\r$' "${script_path}"; then
    log "WARN: ${script_path} contains CRLF line endings; convert to LF to avoid runtime issues"
  fi
}

fail() {
  log "ERROR: $*"
  notify_webhook
  exit 1
}

require_cmd() { command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"; }

file_min_size() {
  local f="$1"
  local label="$2"
  [[ -s "${f}" ]] || fail "${label}: missing or empty: ${f}"
  local sz
  sz="$(stat -c%s "${f}" 2>/dev/null || wc -c <"${f}")"
  [[ "${sz}" -ge "${MIN_DUMP_BYTES}" ]] || fail "${label}: file too small (${sz} bytes < ${MIN_DUMP_BYTES}): ${f}"
}

compose() {
  local -a proj=()
  if [[ -n "${COMPOSE_PROJECT_NAME}" ]]; then
    proj=(-p "${COMPOSE_PROJECT_NAME}")
  fi
  ( cd "${COMPOSE_DIR}" && docker compose "${proj[@]}" "${COMPOSE_ARGS[@]}" "$@" )
}

# rclone helpers (Google Drive); no secrets logged
_normalize_drive_path() {
  local p="${1:-}"
  p="${p#/}"
  p="${p%/}"
  printf '%s' "${p}"
}

_drive_verify_remote_matches_local() {
  local local_path="$1"
  local remote_path="$2"
  local want got sz
  local -a lines
  local n
  sleep 1
  mapfile -t lines < <(rclone ls "${remote_path}" 2>/dev/null || true)
  n="${#lines[@]}"
  if [[ "${n}" -eq 0 ]]; then
    fail "Drive verify: remote file missing (no listings): ${remote_path}"
  fi
  if [[ "${n}" -gt 1 ]]; then
    fail "Drive verify: expected exactly one remote file, got ${n} listings: ${remote_path}"
  fi
  sz="$(awk '{print $1; exit}' <<<"${lines[0]}")"
  [[ -n "${sz}" && "${sz}" =~ ^[0-9]+$ ]] || fail "Drive verify: invalid listing line for ${remote_path}"
  want="$(stat -c%s "${local_path}")"
  got="${sz}"
  [[ "${got}" == "${want}" ]] || fail "Drive verify: size mismatch local=${want} remote=${got} path=${remote_path}"
  log "Drive verify OK (bytes=${want}): ${remote_path}"
}

mkdir -p "${RUN_DIR}" "${STAGING}/postgres" "${STAGING}/mysql" "${STAGING}/erb" "${BACKUP_ROOT}/logs"

exec > >(tee -a "${LOG_FILE}") 2>&1

warn_if_crlf_line_endings

# Disk space preflight: require >= MIN_FREE_BYTES (default 1 GiB) under BACKUP_ROOT
MIN_FREE_BYTES="${MIN_FREE_BYTES:-1073741824}"
free_kb="$(df -Pk "${BACKUP_ROOT}" 2>/dev/null | awk 'NR==2 {print $4}')"
if [[ -z "${free_kb}" || ! "${free_kb}" =~ ^[0-9]+$ ]]; then
  fail "Disk space preflight: cannot determine free space under ${BACKUP_ROOT}"
fi
free_bytes=$(( free_kb * 1024 ))
if (( free_bytes < MIN_FREE_BYTES )); then
  fail "Disk space preflight: free=${free_bytes}B under ${BACKUP_ROOT}, required>=${MIN_FREE_BYTES}B (~1 GiB)"
fi
log "Disk space OK: free=${free_bytes}B under ${BACKUP_ROOT} (min=${MIN_FREE_BYTES}B)"

log "Starting backup run dir=${RUN_DIR}"
if [[ -n "${COMPOSE_PROJECT_NAME}" ]]; then
  log "Compose project: -p ${COMPOSE_PROJECT_NAME} (files: ${COMPOSE_ARGS[*]})"
else
  log "Compose project: default name for ${COMPOSE_DIR} (files: ${COMPOSE_ARGS[*]})"
fi

require_cmd docker
docker compose version >/dev/null 2>&1 || fail "docker compose v2 not available"

[[ -d "${COMPOSE_DIR}" ]] || fail "COMPOSE_DIR not found: ${COMPOSE_DIR}"
[[ -f "${SECRETS_FILE}" ]] || fail "SECRETS_FILE not found: ${SECRETS_FILE}"

# Warn if secrets file is group/other readable
perm="$(stat -c '%a' "${SECRETS_FILE}" 2>/dev/null || echo '')"
if [[ -n "${perm}" && "${perm}" != "600" && "${perm}" != "400" ]]; then
  log "WARN: ${SECRETS_FILE} mode is ${perm}; recommend chmod 600"
fi

set +u
set -a
# shellcheck disable=SC1090
source "${SECRETS_FILE}"
set +a
set -u

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in ${SECRETS_FILE}}"
: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD must be set in ${SECRETS_FILE}}"

compose ps >/dev/null 2>&1 || log "WARN: docker compose ps failed (compose project may be down)"

PG_DUMP="${STAGING}/postgres/numztrak_fuel_${TS}.dump"
log "Postgres: pg_dump (custom format)"
compose exec -T \
  -e "PGPASSWORD=${POSTGRES_PASSWORD}" \
  db \
  pg_dump -U numztrak -d numztrak_fuel -Fc \
  >"${PG_DUMP}"

file_min_size "${PG_DUMP}" "Postgres dump"

MYSQL_DUMP="${STAGING}/mysql/traccar_${TS}.sql.gz"
log "MySQL: mysqldump (gzip)"
compose exec -T \
  -e "MYSQL_PWD=${MYSQL_ROOT_PASSWORD}" \
  traccar-mysql \
  mysqldump -u root --single-transaction --routines --triggers --all-databases \
  | gzip -9 >"${MYSQL_DUMP}"

file_min_size "${MYSQL_DUMP}" "MySQL dump"

ERB_INCLUDED=0
if docker volume inspect "${ERB_VOLUME_NAME}" >/dev/null 2>&1; then
  ERB_TAR="${STAGING}/erb/erb_data_${TS}.tar.gz"
  log "ERB: archiving Docker volume ${ERB_VOLUME_NAME} (override with env ERB_VOLUME_NAME if renamed)"
  docker run --rm \
    -e "TS=${TS}" \
    -v "${ERB_VOLUME_NAME}:/v:ro" \
    -v "${STAGING}/erb:/out" \
    alpine:3.20 \
    sh -c 'tar czf "/out/erb_data_${TS}.tar.gz" -C /v .'
  file_min_size "${ERB_TAR}" "ERB archive"
  ERB_INCLUDED=1
else
  log "ERB: volume ${ERB_VOLUME_NAME} not found — skipping"
fi

log "Building consolidated archive: ${ARCHIVE_PATH}"
TAR_OPTS=(-czf "${ARCHIVE_PATH}" -C "${STAGING}" postgres mysql)
if [[ "${ERB_INCLUDED}" -eq 1 ]]; then
  TAR_OPTS+=(erb)
fi
tar "${TAR_OPTS[@]}"

file_min_size "${ARCHIVE_PATH}" "Archive"

sha256sum "${ARCHIVE_PATH}" | awk '{print $1"  '"${ARCHIVE_NAME}"'"}' >"${CHECKSUM_PATH}"
chmod 600 "${ARCHIVE_PATH}" "${CHECKSUM_PATH}" "${PG_DUMP}" "${MYSQL_DUMP}" 2>/dev/null || true
[[ "${ERB_INCLUDED}" -eq 1 ]] && chmod 600 "${STAGING}/erb/"*.tar.gz 2>/dev/null || true

log "Removing staging directory to save disk"
rm -rf "${STAGING}"

log "Local retention: removing run directories where ${ARCHIVE_NAME} is older than ${RETENTION_DAYS} days (by archive file mtime)"
while IFS= read -r -d '' old_archive; do
  old_run="$(dirname "${old_archive}")"
  log "Retention: rm -rf ${old_run}"
  rm -rf "${old_run}"
done < <(find "${BACKUP_ROOT}/run" -type f -name "${ARCHIVE_NAME}" -mtime "+${RETENTION_DAYS}" -print0 2>/dev/null || true)

if [[ "${DISABLE_S3_UPLOAD}" != "1" ]]; then
  if [[ -n "${S3_BUCKET}" ]]; then
    require_cmd aws
    REMOTE_BASE="${S3_BUCKET%/}/${S3_PREFIX}/${HOST}"
    log "Uploading to ${REMOTE_BASE}/"
    aws s3 cp "${ARCHIVE_PATH}" "${REMOTE_BASE}/${ARCHIVE_NAME}" --only-show-errors
    aws s3 cp "${CHECKSUM_PATH}" "${REMOTE_BASE}/${ARCHIVE_NAME}.sha256" --only-show-errors
    log "Upload complete"
  else
    log "MODE=local-only: S3_BUCKET unset — archives stay on this host only (set S3_BUCKET for off-site copy, or DISABLE_S3_UPLOAD=1 to acknowledge intentionally)"
  fi
else
  log "DISABLE_S3_UPLOAD=1 — skipping upload"
fi

# --- Google Drive (rclone), optional ---
if [[ "${DRIVE_ENABLED}" == "1" ]]; then
  require_cmd rclone
  DRIVE_PATH_NORM="$(_normalize_drive_path "${DRIVE_PATH}")"
  if [[ -n "${DRIVE_PATH_NORM}" ]]; then
    RCLONE_DIR="${DRIVE_PATH_NORM}/${HOST}"
  else
    RCLONE_DIR="${HOST}"
  fi
  RCLONE_BASE="${DRIVE_REMOTE}:${RCLONE_DIR}"
  log "Google Drive: probing remote ${DRIVE_REMOTE}:"
  rclone lsd "${DRIVE_REMOTE}:" || fail "Drive: remote not accessible: ${DRIVE_REMOTE}"
  log "Google Drive upload start -> ${RCLONE_BASE}/"
  rclone mkdir "${RCLONE_BASE}" 2>/dev/null || true
  rclone copyto "${ARCHIVE_PATH}" "${RCLONE_BASE}/${ARCHIVE_NAME}" \
    --transfers 1 --checkers 2 --retries 5 --low-level-retries 10
  _drive_verify_remote_matches_local "${ARCHIVE_PATH}" "${RCLONE_BASE}/${ARCHIVE_NAME}"
  rclone copyto "${CHECKSUM_PATH}" "${RCLONE_BASE}/${ARCHIVE_NAME}.sha256" \
    --transfers 1 --checkers 2 --retries 5 --low-level-retries 10
  _drive_verify_remote_matches_local "${CHECKSUM_PATH}" "${RCLONE_BASE}/${ARCHIVE_NAME}.sha256"
  log "Google Drive upload and verification complete for ${RCLONE_BASE}/"
  if [[ -n "${DRIVE_RETENTION_DAYS}" ]] && [[ "${DRIVE_RETENTION_DAYS}" =~ ^[0-9]+$ ]]; then
    log "Google Drive retention: under ${RCLONE_BASE}/ delete numzfleet_backup_*.tar.gz, numzfleet_backup_*.sha256, numzfleet_backup.tar.gz, numzfleet_backup.tar.gz.sha256 if older than ${DRIVE_RETENTION_DAYS}d"
    if rclone delete "${RCLONE_BASE}" \
      --include 'numzfleet_backup_*.tar.gz' \
      --include 'numzfleet_backup_*.sha256' \
      --include 'numzfleet_backup.tar.gz' \
      --include 'numzfleet_backup.tar.gz.sha256' \
      --min-age "${DRIVE_RETENTION_DAYS}d"; then
      log "Google Drive retention: delete finished (rc=0)"
    else
      log "WARN: Google Drive retention: rclone delete non-zero exit (often no objects matched min-age); continuing"
    fi
  fi
fi

log "SUCCESS"
exit 0
