# NumzTrak — quick reference (root Compose)

This file is a **compact status map** for the standardized stack. Authoritative run/rebuild: repo root **`docker-compose.yml`** (+ optional **`docker-compose.erb.yml`**) and **`rebuild-stack.ps1`**.

## Ports (host)

| Service        | Port | Notes                                      |
|----------------|------|--------------------------------------------|
| Fuel API       | 3000 | Compose service `backend`                  |
| Static UI      | 3002 | Compose service `frontend` (nginx)        |
| Traccar        | 8082 | Compose service `traccar`                  |
| PostgreSQL     | 5432 | Compose service `db`                       |
| Traccar MySQL  | —    | `traccar-mysql`; not published by default |

## Commands (from repo root)

```powershell
docker compose -f docker-compose.yml -f docker-compose.erb.yml ps
docker compose -f docker-compose.yml -f docker-compose.erb.yml logs -f backend
```

Full rebuild (Windows): `.\rebuild-stack.ps1`

## Secrets

Use **`backend/.env`** (from **`backend/.env.example`**). Do not rely on any sample passwords in old docs; they may not match your machine.
