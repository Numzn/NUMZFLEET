# Apply PR1 notification SQL migrations to local Postgres (idempotent).
# Usage from repo root: .\fuel-api\scripts\apply-notification-migrations.ps1
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

$container = if ($env:POSTGRES_CONTAINER) { $env:POSTGRES_CONTAINER } else { 'numzfleet-db-1' }
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'numztrak' }
$db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'numztrak_fuel' }

$files = @(
  'fuel-api\migrations\20260512_notifications.sql',
  'fuel-api\migrations\20260522_notifications_dedup_and_bridge.sql'
)

foreach ($rel in $files) {
  $hostPath = Join-Path $RepoRoot $rel
  if (-not (Test-Path $hostPath)) {
    throw ('Missing migration: ' + $hostPath)
  }
  $leaf = Split-Path $rel -Leaf
  Write-Host ('Applying ' + $leaf + ' ...')
  docker cp $hostPath ($container + ':/tmp/migration.sql')
  docker exec $container psql -U $user -d $db -v ON_ERROR_STOP=1 -f /tmp/migration.sql
}

Write-Host 'Verifying dedup index...'
$indexSql = "SELECT indexname FROM pg_indexes WHERE tablename = 'notifications' AND indexname = 'idx_notifications_user_dedup';"
docker exec $container psql -U $user -d $db -c $indexSql

Write-Host 'Done.'
