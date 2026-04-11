#!/usr/bin/env bash
# push.sh — Commit + push to GitHub only (no server deploy)
# Usage:  bash push.sh "commit message here"
#         bash push.sh              (auto-generates a timestamp message)
set -euo pipefail

stamp() { date +"%Y-%m-%d %H:%M:%S"; }
info()  { echo -e "\n\033[1;36m▶ $1\033[0m"; }
ok()    { echo -e "\033[1;32m  ✔ $1\033[0m"; }
fail()  { echo -e "\033[1;31m  ✖ $1\033[0m"; exit 1; }

BRANCH=$(git rev-parse --abbrev-ref HEAD)

info "Staging all changes"
git add -A
STATUS=$(git status --short)
if [ -z "$STATUS" ]; then
  ok "Working tree clean — nothing to push"
  exit 0
fi
echo "$STATUS"

info "Committing"
MSG="${1:-wip $(stamp)}"
git commit -m "$MSG"
ok "Committed: $MSG"

info "Pushing to origin/$BRANCH"
git push
ok "Pushed $(git rev-parse --short HEAD) → origin/$BRANCH"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "\033[1;32m  PUSHED TO GITHUB\033[0m"
echo "  Branch : $BRANCH"
echo "  Commit : $(git rev-parse --short HEAD)"
echo "  Time   : $(stamp)"
echo "  Next   : run 'bash deploy.sh' when ready to go live"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
