#!/usr/bin/env bash
set -euo pipefail

# Usage: bash push.sh "your commit message"
# Flow: commit and push current branch only (no deployment)

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMMIT_MSG="${1:-chore: update}"

cd "$ROOT_DIR"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

git add -A
if git diff --cached --quiet; then
  echo "No staged changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git push origin "$CURRENT_BRANCH"
echo "Pushed to origin/$CURRENT_BRANCH"
