# Legacy deployment Dockerfiles (superseded)

These files were an alternate root-context build path for frontend/backend. **Do not use for production.**

Canonical builds:

- [deployment/push/build-release-images.sh](../../../deployment/push/build-release-images.sh) (local/CI)
- App Dockerfiles: `traccar-fleet-system/frontend/Dockerfile`, `fuel-api/Dockerfile`, `erb-fuel-monitor/Dockerfile`

Registry images: `numzfleet-frontend`, `numzfleet-backend`, `numzfleet-erb` (see [deployment/REGISTRY_DEPLOY.md](../../../deployment/REGISTRY_DEPLOY.md)).
