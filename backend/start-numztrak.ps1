# Legacy filename kept for bookmarks. Canonical stack is repo root Compose + rebuild-stack.ps1.
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$rebuild = Join-Path $RepoRoot 'rebuild-stack.ps1'
if (Test-Path -LiteralPath $rebuild) {
  Write-Host 'Delegating to repo root rebuild-stack.ps1 ...' -ForegroundColor Cyan
  & $rebuild @args
} else {
  Write-Host 'rebuild-stack.ps1 not found; running docker compose up -d --build ...' -ForegroundColor Yellow
  docker compose -f docker-compose.yml -f docker-compose.erb.yml up -d --build
}
