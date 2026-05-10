#!/usr/bin/env bash
# Persistent shortcut for production SSH login.
# Default IP is also in deployment/scripts/auto_deploy.defaults.env — update both if the instance changes.
set -euo pipefail

HOST="${OCI_PROD_HOST:-129.151.163.95}"
USER_NAME="${OCI_PROD_USER:-ubuntu}"
KEY_PATH="${OCI_PROD_KEY:-$HOME/.ssh/oci_instance_key.pem}"

exec /usr/bin/ssh \
  -o StrictHostKeyChecking=accept-new \
  -i "$KEY_PATH" \
  "${USER_NAME}@${HOST}"
