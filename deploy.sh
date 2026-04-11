#!/usr/bin/env bash
# deploy.sh — Full deploy pipeline: build → commit → push → server pull → restart → verify
# Usage:  bash deploy.sh "commit message here"
#         bash deploy.sh              (auto-generates a timestamp message)
set -euo pipefail

#──────────────────────────── Config ────────────────────────────
REMOTE_USER="ubuntu"
REMOTE_HOST="129.151.163.95"
SSH_KEY="$HOME/.ssh/oci_instance_key.pem"
SSH_OPTS="-o BatchMode=yes -o StrictHostKeyChecking=accept-new"
REMOTE_DIR="~/NUMZFLEET"
COMPOSE_FILE="docker-compose.prod.yml"
FRONTEND_DIR="traccar-fleet-system/frontend"
SITE_URL="https://numz.site"
FUEL_HEALTH_URL="https://numz.site/api/fuel-requests/health"

ssh_cmd() { ssh $SSH_OPTS -i "$SSH_KEY" "${REMOTE_USER}@${REMOTE_HOST}" "$@"; }

#──────────────────────────── Helpers ───────────────────────────
stamp()  { date +"%Y-%m-%d %H:%M:%S"; }
info()   { echo -e "\n\033[1;36m▶ $1\033[0m"; }
ok()     { echo -e "\033[1;32m  ✔ $1\033[0m"; }
fail()   { echo -e "\033[1;31m  ✖ $1\033[0m"; exit 1; }

#──────────────────────────── Pre-checks ────────────────────────
info "Pre-flight checks"
command -v git  >/dev/null || fail "git not found"
command -v node >/dev/null || fail "node not found"
command -v npm  >/dev/null || fail "npm not found"
command -v ssh  >/dev/null || fail "ssh not found"
command -v curl >/dev/null || fail "curl not found"
[ -f "$SSH_KEY" ] || fail "SSH key not found at $SSH_KEY"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
ok "Branch: $BRANCH"

# Ensure we have something to deploy
if git diff --quiet && git diff --cached --quiet; then
  echo "  ⚠  Working tree is clean — nothing new to commit."
  echo "     Continuing anyway (will push + sync server)."
fi

#──────────────────────────── 1. Build ──────────────────────────
info "Step 1/6 — Building frontend"
npm --prefix "$FRONTEND_DIR" run build
BUNDLE=$(ls -t "$FRONTEND_DIR/dist/assets"/index-*.js 2>/dev/null | head -1)
ok "Bundle: $(basename "${BUNDLE:-none}")"

#──────────────────────────── 2. Stage + Commit ─────────────────
info "Step 2/6 — Staging & committing"
git add -A
MSG="${1:-deploy $(stamp)}"
if git diff --cached --quiet; then
  ok "No new changes to commit (already up to date)"
else
  git commit -m "$MSG"
  ok "Committed: $MSG"
fi
LOCAL_SHA=$(git rev-parse --short HEAD)
ok "Local HEAD: $LOCAL_SHA"

#──────────────────────────── 3. Push ───────────────────────────
info "Step 3/6 — Pushing to GitHub"
git push
ok "Pushed to origin/$BRANCH"

#──────────────────────────── 4. Server pull ────────────────────
info "Step 4/6 — Syncing server"
ssh_cmd "set -e; cd $REMOTE_DIR; git fetch origin --prune; git checkout $BRANCH; git pull --ff-only origin $BRANCH; echo SERVER_HEAD=\$(git rev-parse --short HEAD)"
ok "Server fast-forwarded"

#──────────────────────────── 5. Upload dist + restart ──────────
info "Step 5/6 — Deploying frontend dist & restarting nginx"
# SCP the built dist to server (atomic replace)
ssh_cmd "rm -rf ${REMOTE_DIR}/${FRONTEND_DIR}/dist"
tar -C "${FRONTEND_DIR}/dist" -cf - . | ssh_cmd "mkdir -p ${REMOTE_DIR}/${FRONTEND_DIR}/dist && tar -C ${REMOTE_DIR}/${FRONTEND_DIR}/dist -xf -"
ok "Frontend dist uploaded"

# Restart nginx to pick up new static files
ssh_cmd "cd ${REMOTE_DIR}/backend && docker-compose -f $COMPOSE_FILE restart numztrak-nginx"
ok "nginx restarted"

#──────────────────────────── 6. Verify ─────────────────────────
info "Step 6/6 — Verifying live site"
sleep 3
SITE_HTTP=$(curl -k -sS -o /dev/null -w "%{http_code}" --max-time 15 "$SITE_URL" || echo "000")
FUEL_HTTP=$(curl -k -sS -o /dev/null -w "%{http_code}" --max-time 15 "$FUEL_HEALTH_URL" || echo "000")
LIVE_BUNDLE=$(curl -k -sS --max-time 15 "$SITE_URL" 2>/dev/null | grep -oP 'assets/index-[^"]+\.js' | head -1)

[ "$SITE_HTTP" = "200" ] && ok "Site: $SITE_URL → HTTP $SITE_HTTP" || fail "Site returned HTTP $SITE_HTTP"
[ "$FUEL_HTTP" = "200" ] && ok "Fuel API health → HTTP $FUEL_HTTP"  || fail "Fuel health returned HTTP $FUEL_HTTP"
ok "Live bundle: $LIVE_BUNDLE"

#──────────────────────────── Summary ───────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "\033[1;32m  DEPLOYED SUCCESSFULLY\033[0m"
echo "  Branch : $BRANCH"
echo "  Commit : $LOCAL_SHA"
echo "  Bundle : $(basename "${BUNDLE:-unknown}")"
echo "  Site   : $SITE_URL"
echo "  Time   : $(stamp)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
