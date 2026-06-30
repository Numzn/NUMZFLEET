#!/usr/bin/env bash
# RETIRED — staging is not used. See deployment/STAGING_RETIRED.md
set -euo pipefail
echo "[run-staging-deploy-homelab] ERROR: Staging deploy is retired." >&2
echo "  Dev: ./scripts/dev" >&2
echo "  Production: python3 deployment/scripts/auto_deploy.py --target production --skip-git --deploy-image-tag <sha>" >&2
exit 1
