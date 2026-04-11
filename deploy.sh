#!/usr/bin/env bash
set -euo pipefail

# Usage: bash deploy.sh "your commit message"
# Flow: local build gate -> commit -> push to origin/main -> GitHub Actions deploys to server

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/traccar-fleet-system/frontend"
COMMIT_MSG="${1:-deploy: update frontend}"

cd "$ROOT_DIR"

echo "[1/5] Running local production build gate..."
cd "$FRONTEND_DIR"
npm run build

echo "[2/5] Build passed. Preparing git commit..."
cd "$ROOT_DIR"
git add -A

if git diff --cached --quiet; then
  echo "No staged changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

echo "[3/5] Pushing current HEAD to origin/main..."
git push origin HEAD:main

echo "[4/5] Deployment pipeline triggered in GitHub Actions."
echo "Actions URL: https://github.com/Numzn/NUMZGPS/actions"

echo "[5/5] Done. Watch the workflow until it reaches green."
