# Apply all idempotent fuel-api SQL migrations in deploy order.
# Canonical list: fuel-api/migrations/MIGRATION_ORDER (same as deployment/utils/run-fuel-migrations.sh).
# Usage from repo root: .\fuel-api\scripts\apply-fuel-migrations.ps1
# Optional: $env:POSTGRES_CONTAINER = 'numzfleet-db-1'
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

$container = if ($env:POSTGRES_CONTAINER) { $env:POSTGRES_CONTAINER } else {
  $names = @(docker ps --format '{{.Names}}' 2>$null | Where-Object { $_ -match 'db' })
  if ($names.Count -eq 1) { $names[0] } else { 'numzfleet-db-1' }
}
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'numztrak' }
$db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'numztrak_fuel' }

$orderFile = Join-Path $RepoRoot 'fuel-api\migrations\MIGRATION_ORDER'
if (-not (Test-Path $orderFile)) {
  throw "Missing migration manifest: $orderFile"
}

$listed = @()
Get-Content $orderFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $listed += (Split-Path $line -Leaf)
}

if ($listed.Count -eq 0) {
  throw "No migrations listed in $orderFile"
}

$onDisk = @(Get-ChildItem (Join-Path $RepoRoot 'fuel-api\migrations\*.sql') | ForEach-Object { $_.Name })
foreach ($name in $onDisk) {
  if ($listed -notcontains $name) {
    throw "Untracked migration $name — add it to fuel-api/migrations/MIGRATION_ORDER"
  }
}

Write-Host "Postgres container: $container"
Write-Host "Database: $db (user: $user)"
Write-Host "Applying $($listed.Count) migration(s) from MIGRATION_ORDER"
Write-Host ''

foreach ($leaf in $listed) {
  $hostPath = Join-Path $RepoRoot "fuel-api\migrations\$leaf"
  if (-not (Test-Path $hostPath)) {
    throw ('Missing migration: ' + $hostPath)
  }
  Write-Host ('Applying ' + $leaf + ' ...')
  docker cp $hostPath ($container + ':/tmp/migration.sql')
  docker exec $container psql -U $user -d $db -v ON_ERROR_STOP=1 -f /tmp/migration.sql
}

Write-Host ''
Write-Host 'Verifying vehicles.company_id ...'
docker exec $container psql -U $user -d $db -c `
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'company_id';"

Write-Host 'Done.'
