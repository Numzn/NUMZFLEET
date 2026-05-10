# Archived deployment paths (deprecated)

This directory contains **deprecated** deployment/build paths kept for reference only.

## Canonical production model (source of truth)

- **CI**: builds and pushes images only (tagged with full git SHA)
- **Registry**: source of truth for production images
- **Server**: pull-only, manual deployment initiated on the server:
  - `deployment/deploy/deploy-from-registry.sh`
  - optionally, migrations + deploy: `deployment/run-migrate-and-deploy.sh`

## Why these files are archived

The items in this folder represent alternate/legacy approaches (e.g. repo-root Docker builds, nginx edge configs).
They are archived to avoid conflicting deployment paths while preserving history.

