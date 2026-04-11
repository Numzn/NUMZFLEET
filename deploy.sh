#!/usr/bin/env bash
set -euo pipefail

# Usage: bash deploy.sh "your commit message"
# Flow: build locally -> commit -> push to GitHub -> SCP dist to server -> nginx reload -> verify

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/traccar-fleet-system/frontend"
COMMIT_MSG="${1:-deploy: update frontend}"
OCI_HOST="129.151.163.95"
OCI_USER="ubuntu"
SSH_KEY="$HOME/.ssh/oci_instance_key"
REMOTE_DIST="/home/$OCI_USER/NUMZFLEET/traccar-fleet-system/frontend/dist"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"

echo "========================================"
echo " NumzFleet Deploy"
echo "========================================"

# --- Step 1: Local build gate ---
echo ""
echo "[1/5] Building frontend locally..."
cd "$FRONTEND_DIR"
npm run build
echo "      ✅ Build passed."

# --- Step 2: Commit & push to GitHub ---
echo ""
echo "[2/5] Committing and pushing to GitHub..."
cd "$ROOT_DIR"
git add -A
if git diff --cached --quiet; then
  echo "      No staged changes — skipping commit."
else
  git commit -m "$COMMIT_MSG"
fi
git push origin HEAD:main
echo "      ✅ Pushed to origin/main."

# --- Step 3: Upload dist to server ---
echo ""
echo "[3/5] Uploading dist to server..."
ssh $SSH_OPTS "$OCI_USER@$OCI_HOST" "rm -rf $REMOTE_DIST/*"
scp $SSH_OPTS -r "$FRONTEND_DIR/dist/"* "$OCI_USER@$OCI_HOST:$REMOTE_DIST/"
echo "      ✅ Files uploaded."

# --- Step 4: Reload nginx ---
echo ""
echo "[4/5] Reloading nginx..."
ssh $SSH_OPTS "$OCI_USER@$OCI_HOST" "docker exec numztrak-nginx nginx -s reload"
echo "      ✅ Nginx reloaded."

# --- Step 5: Verify ---
echo ""
echo "[5/5] Verifying deployment..."
sleep 3
HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" "https://numz.site" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "      ✅ https://numz.site is live (HTTP $HTTP_CODE)"
else
  echo "      ⚠️  https://numz.site returned HTTP $HTTP_CODE — check manually"
  exit 1
fi

echo ""
echo "========================================"
echo " Deploy complete!"
echo "========================================"
