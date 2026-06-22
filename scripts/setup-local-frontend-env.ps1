<#
.SYNOPSIS
  Write traccar-fleet-system/frontend/.env for local Docker dev (localhost:8082 + :3000).

.EXAMPLE
  .\scripts\setup-local-frontend-env.ps1
#>
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$OutPath = Join-Path $RepoRoot 'traccar-fleet-system\frontend\.env'

$content = @"
# Local Dev PC — Vite proxies to Docker on localhost
# Traccar: http://localhost:8082   fuel-api: http://localhost:3000
#
# Start stack:  docker compose -f docker-compose.yml up -d
# Start UI:     npm run start:local
# Open:        http://localhost:5174

LOCAL_DEV=true
VITE_DEV_SERVER_PORT=5174
VITE_HMR_EXTERNAL=
"@

Set-Content -LiteralPath $OutPath -Value $content.TrimEnd() -Encoding UTF8
Add-Content -LiteralPath $OutPath -Value "" -Encoding UTF8

Write-Host "Wrote $OutPath (LOCAL_DEV -> localhost:8082 / :3000)" -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  docker compose -f docker-compose.yml up -d"
Write-Host "  cd traccar-fleet-system\frontend"
Write-Host "  npm run start:local"
Write-Host "  Open http://localhost:5174"
