#!/usr/bin/env bash
# Deterministic production UI deploy: Docker (Node 20) build -> scp dist -> nginx reload.
#
# Git: refuses to run if the repo has uncommitted changes (so each deploy matches a real commit).
#     Override only when you must: DEPLOY_ALLOW_DIRTY=1
#     To require branch main: DEPLOY_REQUIRE_MAIN=1
# API: curls API health before build (override URL with API_HEALTH_URL; skip with SKIP_API_HEALTH_CHECK=1).
# Server: optional dist backup before overwrite (REMOTE_BACKUP); deploy lock (LOCK_REMOTE) with trap cleanup.
# Push to origin yourself; this script does not call git push.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/traccar-fleet-system/frontend"
# Docker Desktop on Windows + Git Bash: bind mounts need a Windows path (cygpath -w).
FRONTEND_VOLUME="$FRONTEND_DIR"
if command -v cygpath >/dev/null 2>&1; then
  case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*) FRONTEND_VOLUME="$(cygpath -w "$FRONTEND_DIR")" ;;
  esac
fi

# --- Git safety (clean tree = traceable deploy) ---
echo "[1/8] Checking Git state..."
if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: Not a Git repository at $ROOT_DIR. Aborting." >&2
  exit 1
fi

# Only tracked-file changes block deploy; untracked (e.g. .cursor/plans) is ignored.
if [[ "${DEPLOY_ALLOW_DIRTY:-0}" != "1" ]] && [[ -n "$(git -C "$ROOT_DIR" status --porcelain --untracked-files=no)" ]]; then
  echo "ERROR: Uncommitted changes to tracked files (deploy would not match a single Git revision):" >&2
  git -C "$ROOT_DIR" status --short --untracked-files=no >&2
  echo "Commit or stash, then retry. Emergency only: DEPLOY_ALLOW_DIRTY=1 ./deploy-frontend-docker.sh" >&2
  exit 1
fi

COMMIT_HASH="$(git -C "$ROOT_DIR" rev-parse HEAD)"
BRANCH="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
COMMIT_SUBJECT="$(git -C "$ROOT_DIR" log -1 --pretty=%s | tr '\n' ' ' | tr -d '\"')"

if [[ "${DEPLOY_REQUIRE_MAIN:-0}" == "1" ]] && [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: Branch is '$BRANCH' but DEPLOY_REQUIRE_MAIN=1 requires main. Aborting." >&2
  exit 1
fi

echo "      Branch : $BRANCH"
echo "      Commit : $COMMIT_HASH"
echo "      Message:"
git -C "$ROOT_DIR" log -1 --pretty=format:'      %s%n' || true
echo ""

SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_instance_key}"
SERVER="${SERVER:-ubuntu@129.151.163.95}"
REMOTE_DIST="${REMOTE_DIST:-/home/ubuntu/NUMZFLEET/traccar-fleet-system/frontend/dist}"
REMOTE_BACKUP="${REMOTE_BACKUP:-/home/ubuntu/NUMZFLEET/backups/dist}"
LOCK_REMOTE="${LOCK_REMOTE:-/tmp/frontend-deploy.lock}"
REMOTE_VERSION_FILE="${REMOTE_VERSION_FILE:-/home/ubuntu/NUMZFLEET/frontend-deploy-version.txt}"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://api.numz.site}"
# fuel-api exposes GET /health (see fuel-api/src/server.js)
API_HEALTH_URL="${API_HEALTH_URL:-${VITE_API_BASE_URL%/}/health}"
NODE_IMAGE="${NODE_IMAGE:-node:20-bookworm-slim}"

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=no)

release_deploy_lock() {
  ssh "${SSH_OPTS[@]}" "$SERVER" "rm -f \"$LOCK_REMOTE\"" 2>/dev/null || true
}

echo "========================================"
echo " NumzFleet frontend deploy (Docker)"
echo "========================================"
echo "  Frontend dir  : $FRONTEND_DIR"
echo "  Docker volume : $FRONTEND_VOLUME"
echo "  Server        : $SERVER"
echo "  Remote dist   : $REMOTE_DIST"
echo "  Remote backup : $REMOTE_BACKUP"
echo "  Lock file     : $LOCK_REMOTE"
echo "  Version file  : $REMOTE_VERSION_FILE"
echo "  API base URL  : $VITE_API_BASE_URL"
echo "  API health URL: $API_HEALTH_URL"
echo ""

if [[ ! -f "$SSH_KEY" ]]; then
  echo "ERROR: SSH key not found: $SSH_KEY" >&2
  echo "Set SSH_KEY to your private key path if different." >&2
  exit 1
fi

if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
  echo "ERROR: Missing $FRONTEND_DIR/package.json (run from repo clone)." >&2
  exit 1
fi

echo "[2/8] Checking API is reachable..."
if [[ "${SKIP_API_HEALTH_CHECK:-0}" != "1" ]]; then
  curl -sfS --max-time 15 "$API_HEALTH_URL" >/dev/null \
    || { echo "ERROR: API health check failed ($API_HEALTH_URL). Fix API or set SKIP_API_HEALTH_CHECK=1." >&2; exit 1; }
  echo "      API OK."
else
  echo "      Skipped (SKIP_API_HEALTH_CHECK=1)."
fi
echo ""

echo "[3/8] Building frontend in Docker ($NODE_IMAGE)..."
docker run --rm \
  -v "$FRONTEND_VOLUME:/app" \
  -w /app \
  -e "VITE_API_BASE_URL=$VITE_API_BASE_URL" \
  "$NODE_IMAGE" \
  bash -lc "npm ci && npm run build"

if [[ ! -f "$FRONTEND_DIR/dist/index.html" ]]; then
  echo "ERROR: Build did not produce dist/index.html" >&2
  exit 1
fi
echo "      Build OK."
echo ""

echo "[4/8] Acquiring deploy lock..."
ssh "${SSH_OPTS[@]}" "$SERVER" bash -c "set -e; if [[ -f \"$LOCK_REMOTE\" ]]; then echo 'Another frontend deploy is in progress. Try again shortly.' >&2; exit 1; fi; touch \"$LOCK_REMOTE\""
trap release_deploy_lock EXIT
echo "      Lock acquired (cleared on exit)."
echo ""

echo "[5/8] Backing up current dist (rollback snapshot)..."
if [[ "${SKIP_DIST_BACKUP:-0}" != "1" ]]; then
  ssh "${SSH_OPTS[@]}" "$SERVER" "bash -s" <<BACKUPSCRIPT
set -euo pipefail
REMOTE_DIST="${REMOTE_DIST}"
REMOTE_BACKUP="${REMOTE_BACKUP}"
mkdir -p "\$(dirname "\$REMOTE_BACKUP")"
rm -rf "\$REMOTE_BACKUP"
if [[ -d "\$REMOTE_DIST" ]] && [[ -n "\$(ls -A "\$REMOTE_DIST" 2>/dev/null || true)" ]]; then
  cp -a "\$REMOTE_DIST" "\$REMOTE_BACKUP"
  echo "      Backup: \$REMOTE_BACKUP"
  echo "      Rollback hint: ssh then: rm -rf \"\$REMOTE_DIST\"/* && cp -a \"\$REMOTE_BACKUP\"/. \"\$REMOTE_DIST\"/"
else
  echo "      No prior dist to backup (first deploy or empty dir)."
fi
BACKUPSCRIPT
else
  echo "      Skipped (SKIP_DIST_BACKUP=1)."
fi
echo ""

echo "[6/8] Clearing remote dist + uploading..."
ssh "${SSH_OPTS[@]}" "$SERVER" "rm -rf ${REMOTE_DIST}/*"
scp "${SSH_OPTS[@]}" -r "$FRONTEND_DIR/dist/"* "${SERVER}:${REMOTE_DIST}/"
echo ""

echo "[7/8] Reloading nginx + verify..."
ssh "${SSH_OPTS[@]}" "$SERVER" "docker exec numztrak-nginx nginx -s reload"
sleep 3
HTTP_CODE="$(curl -sI -o /dev/null -w "%{http_code}" "https://numz.site" 2>/dev/null || echo "000")"
if [[ "$HTTP_CODE" == "200" ]]; then
  echo "      https://numz.site OK (HTTP $HTTP_CODE)"
else
  echo "      WARNING: https://numz.site returned HTTP $HTTP_CODE — check manually." >&2
  exit 1
fi

DEPLOYED_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
API_HEALTH_CHECKED="0"
if [[ "${SKIP_API_HEALTH_CHECK:-0}" != "1" ]]; then
  API_HEALTH_CHECKED="1"
fi

echo "      Writing deploy metadata -> $REMOTE_VERSION_FILE ..."
ssh "${SSH_OPTS[@]}" "$SERVER" "cat > \"$REMOTE_VERSION_FILE\"" <<EOF
product=numztrak-frontend
branch=${BRANCH}
commit=${COMMIT_HASH}
subject=${COMMIT_SUBJECT}
deployed_utc=${DEPLOYED_UTC}
deployed_by=deploy-frontend-docker.sh
api_base=${VITE_API_BASE_URL}
api_health_url=${API_HEALTH_URL}
api_health_precheck=${API_HEALTH_CHECKED}
rollback_dist_backup=${REMOTE_BACKUP}
EOF
echo "      On server: cat $REMOTE_VERSION_FILE"

trap - EXIT
release_deploy_lock
echo "      Lock released."

echo ""
echo "========================================"
echo " Frontend deploy complete."
echo "========================================"
