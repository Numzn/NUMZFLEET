# NUMZFLEET
NUMZFLEET (NumzTrak) — Monorepo for fleet GPS + fuel ops: Traccar (Java/MySQL), Fuel API (Node/PostgreSQL/Socket.IO), React/Vite UI. Standard runtime: root Docker Compose + optional ERB overlay; secrets in backend/.env. Dev rebuild: rebuild-stack.ps1. Prod: edge routes /api + /socket.io → fuel API, /traccar → Traccar.
