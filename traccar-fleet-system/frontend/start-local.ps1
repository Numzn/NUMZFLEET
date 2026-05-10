# Start frontend in local dev mode (Vite HMR).
# Run APIs with root Docker Compose from the monorepo root first.

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Frontend in LOCAL Mode" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Mode: Local Development (HMR)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Backend URLs (from host; use with LOCAL_DEV=true):" -ForegroundColor Cyan
Write-Host "  - Traccar: http://localhost:8082" -ForegroundColor White
Write-Host "  - Fuel API: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Vite dev server (default): http://localhost:5174" -ForegroundColor Green
Write-Host ""
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Write-Host "Tip: from repo root start the stack, then run this script:" -ForegroundColor Yellow
Write-Host "  cd $repoRoot" -ForegroundColor Gray
Write-Host "  .\rebuild-stack.ps1 -SkipVerify" -ForegroundColor Gray
Write-Host "  # or: docker compose -f docker-compose.yml -f docker-compose.erb.yml up -d" -ForegroundColor Gray
Write-Host "  # Free port 3002 if Docker static UI is up: docker compose stop frontend" -ForegroundColor Gray
Write-Host ""

$env:LOCAL_DEV = "true"
npm run start:local
