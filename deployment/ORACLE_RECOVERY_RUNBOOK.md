# Oracle Recovery Runbook (numz.site)

This runbook is for stabilizing an existing Oracle VM deployment and then relaunching services in a safe order.

## Scope

- Host: single Oracle VM
- Domain: numz.site
- Stack components:
  - traccar-mysql
  - traccar-server
  - fuel-postgres
  - fuel-api
  - numztrak-nginx

## 1. Baseline Audit

Run on the Oracle VM from the backend folder.

~~~bash
cd ~/NUMZFLEET/backend

echo "=== Compose version ==="
docker compose version || docker-compose version

echo "=== Service status ==="
docker compose -f docker-compose.prod.yml ps || docker-compose -f docker-compose.prod.yml ps

echo "=== Containers ==="
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

echo "=== Listening ports ==="
sudo ss -tulpen | grep -E ":80|:443|:8082|:3001|:5055|:3306|:5432" || true

echo "=== Nginx config check ==="
docker run --rm -v "$PWD/nginx/nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t

echo "=== Public edge check ==="
curl -I https://numz.site || true
curl -sS http://127.0.0.1:8082/api/server || true
curl -sS http://127.0.0.1:3001/health || true
~~~

## 2. Clean Previous Drift

Use this only when you are ready to relaunch with docker-compose.prod.yml as the source of truth.

~~~bash
cd ~/NUMZFLEET/backend

docker compose down --remove-orphans || docker-compose down --remove-orphans
~~~

Do not remove volumes unless you intentionally want data reset.

## 3. Prepare Environment

Create or update backend .env with strong values.

Required keys:

- MYSQL_ROOT_PASSWORD
- MYSQL_PASSWORD
- POSTGRES_PASSWORD
- SESSION_SECRET
- CORS_ORIGIN (recommended: https://numz.site,https://app.numz.site)

## 4. SSL Certificates

This stack expects certs at host paths:

- /etc/letsencrypt/live/numz.site/fullchain.pem
- /etc/letsencrypt/live/numz.site/privkey.pem

Validate cert files:

~~~bash
sudo test -f /etc/letsencrypt/live/numz.site/fullchain.pem && echo ok-fullchain
sudo test -f /etc/letsencrypt/live/numz.site/privkey.pem && echo ok-privkey
~~~

## 5. Relaunch in Phases

### Phase A: Traccar core only

~~~bash
cd ~/NUMZFLEET/backend

docker compose -f docker-compose.prod.yml up -d traccar-mysql traccar-server || \
  docker-compose -f docker-compose.prod.yml up -d traccar-mysql traccar-server

docker logs --tail 150 numztrak-traccar
curl -sS http://127.0.0.1:8082/api/server
~~~

### Phase B: Fuel services

~~~bash
cd ~/NUMZFLEET/backend

docker compose -f docker-compose.prod.yml up -d fuel-postgres fuel-api || \
  docker-compose -f docker-compose.prod.yml up -d fuel-postgres fuel-api

docker logs --tail 150 numztrak-fuel-api
curl -sS http://127.0.0.1:3001/health
~~~

### Phase C: Nginx edge

~~~bash
cd ~/NUMZFLEET/backend

docker compose -f docker-compose.prod.yml up -d numztrak-nginx || \
  docker-compose -f docker-compose.prod.yml up -d numztrak-nginx

curl -k https://127.0.0.1/health
curl -I https://numz.site
~~~

## 6. GPS Validation (OsmAnd)

- Configure device host: numz.site
- Configure device port: 5055
- Verify positions appear in Traccar UI and logs.

## 7. Post-Deploy Hardening

- Keep 3306 and 5432 blocked from internet at OCI and UFW.
- Keep 80 and 443 open for web edge.
- Keep 5055 open for GPS traffic.
- Rotate any previously exposed passwords.

## 8. Rollback

If Nginx or Fuel changes fail, keep Traccar online and roll back non-core services:

~~~bash
cd ~/NUMZFLEET/backend

docker compose -f docker-compose.prod.yml stop numztrak-nginx fuel-api fuel-postgres || \
  docker-compose -f docker-compose.prod.yml stop numztrak-nginx fuel-api fuel-postgres

docker compose -f docker-compose.prod.yml ps || docker-compose -f docker-compose.prod.yml ps
~~~
