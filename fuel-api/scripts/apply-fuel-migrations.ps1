# Apply all idempotent fuel-api SQL migrations in deploy order.
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

$files = @(
  'fuel-api\migrations\20260503_create_operation_sessions_tables.sql',
  'fuel-api\migrations\20260427_daily_intelligent_refueling.sql',
  'fuel-api\migrations\20260429_refuel_status_incomplete.sql',
  'fuel-api\migrations\20260512_notifications.sql',
  'fuel-api\migrations\20260522_notifications_dedup_and_bridge.sql',
  'fuel-api\migrations\20260520_vehicle_immobilization_intents.sql',
  'fuel-api\migrations\20260521_immobilization_execution_integrity.sql',
  'fuel-api\migrations\20260613_operational_day_model.sql',
  'fuel-api\migrations\20260616_multi_tenant_foundation.sql',
  'fuel-api\migrations\20260619_service_records.sql',
  'fuel-api\migrations\20260620_fuel_operations_phase1.sql',
  'fuel-api\migrations\20260621_fueling_day_multi_invoice_arrived.sql',
  'fuel-api\migrations\20260622_invoice_attachment_url.sql',
  'fuel-api\migrations\20260623_fueling_day_reference_and_skip.sql',
  'fuel-api\migrations\20260624_service_records_fleet_vehicle.sql'
)

Write-Host "Postgres container: $container"
Write-Host "Database: $db (user: $user)"
Write-Host ''

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

Write-Host ''
Write-Host 'Verifying vehicles.company_id ...'
docker exec $container psql -U $user -d $db -c `
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'company_id';"

Write-Host 'Done.'
