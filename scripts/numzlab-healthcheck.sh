#!/usr/bin/env bash
# NumzLab health checks — dev stack (hot reload). Run from repo root.
# Staging is retired; this delegates to scripts/verify.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "${ROOT}/scripts/verify" "$@"
