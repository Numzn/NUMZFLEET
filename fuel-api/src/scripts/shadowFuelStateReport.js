#!/usr/bin/env node
/**
 * Shadow-mode Fuel State validation report (Increment 3).
 * Read-only: runs the Digital Fuel Twin projection for every actively assigned
 * vehicle and reports availability, unavailable reasons, provenance, and
 * calibration opportunities. Zero DB writes.
 *
 * Usage: node src/scripts/shadowFuelStateReport.js [--out ./shadow-output]
 */
import fs from 'node:fs';
import path from 'node:path';
import { DeviceAssignment } from '../models/index.js';
import { getVehicleSpec } from '../services/vehicleSpecService.js';
import { loadFuelLearningState } from '../vehicleEngine/fuel/fuelLearningService.js';
import { projectFuelState } from '../vehicleEngine/fuel/fuelStateService.js';
import { getVehicleTelemetry } from '../services/refuelTelemetryService.js';

function parseOutDir(argv) {
  const idx = argv.indexOf('--out');
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return './shadow-output';
}

function telemetryLitres(telemetry, tankCapacityLitres) {
  const frac = telemetry?.tankLevelFraction;
  if (frac == null || tankCapacityLitres == null) return null;
  let level = Number(frac);
  if (!Number.isFinite(level)) return null;
  if (level > 1 && level <= 100) level /= 100;
  return Math.round(level * tankCapacityLitres * 10) / 10;
}

function unavailableReasons(projection) {
  return (projection.diagnostics || []).map((d) => d.code);
}

async function main() {
  const outDir = parseOutDir(process.argv.slice(2));

  const assignments = await DeviceAssignment.findAll({
    where: { isActive: true },
    attributes: ['vehicleId', 'deviceId'],
  });

  const vehicles = [];
  for (const assignment of assignments) {
    const deviceId = Number(assignment.deviceId);
    const fleetVehicleId = assignment.vehicleId;

    let spec = null;
    let learning = null;
    let telemetry = null;
    try { spec = await getVehicleSpec(deviceId); } catch { /* spec optional */ }
    try { learning = await loadFuelLearningState(fleetVehicleId); } catch { /* learning optional */ }
    try { telemetry = await getVehicleTelemetry(deviceId); } catch { /* telemetry optional */ }

    let projection;
    try {
      projection = await projectFuelState({
        deviceId,
        learning,
        hubFuel: null,
        specEfficiency: spec?.fuelEfficiency ?? null,
      });
    } catch (error) {
      projection = {
        available: false,
        source: 'unavailable',
        diagnostics: [{ code: 'projection_error', message: error?.message ?? 'unknown' }],
      };
    }

    vehicles.push({
      fleetVehicleId,
      deviceId,
      available: projection.available,
      unavailableReasons: projection.available ? [] : unavailableReasons(projection),
      anchorRefuelId: projection.anchorRefuelId ?? null,
      anchorAt: projection.anchorAt ?? null,
      anchorMileageKm: projection.anchorMileageKm ?? null,
      currentMileageKm: projection.currentMileageKm ?? null,
      distanceSinceAnchorKm: projection.distanceSinceAnchorKm ?? null,
      efficiencyKmL: projection.efficiencyKmL ?? null,
      efficiencySource: projection.efficiencySource ?? null,
      modelMaturity: projection.modelMaturity ?? null,
      projectionQuality: projection.projectionQuality ?? null,
      modelledLitresRemaining: projection.modelledLitresRemaining ?? null,
      estimatedSpaceLitres: projection.estimatedSpaceLitres ?? null,
      tankCapacityLitres: projection.tankCapacityLitres ?? null,
      tankCapacitySource: projection.tankCapacitySource ?? null,
      telemetryLitresRemaining: telemetryLitres(telemetry, projection.tankCapacityLitres ?? spec?.tankCapacity ?? null),
      calibrationOpportunities: projection.calibrationOpportunities ?? [],
      diagnostics: projection.diagnostics ?? [],
    });
  }

  const availableCount = vehicles.filter((v) => v.available).length;
  const reasonCounts = {};
  for (const v of vehicles) {
    for (const reason of v.unavailableReasons) {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    projectionMode: 'shadow',
    vehiclesEvaluated: vehicles.length,
    vehiclesAvailable: availableCount,
    vehiclesUnavailable: vehicles.length - availableCount,
    unavailableReasonCounts: reasonCounts,
    calibrationOpportunitiesTotal: vehicles.reduce((n, v) => n + v.calibrationOpportunities.length, 0),
    vehicles,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `shadow-fuel-state-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`Shadow Fuel State report — ${report.vehiclesEvaluated} vehicles evaluated`);
  console.log(`  available:   ${report.vehiclesAvailable}`);
  console.log(`  unavailable: ${report.vehiclesUnavailable}`);
  for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${reason}: ${count}`);
  }
  for (const v of vehicles.filter((r) => r.available)) {
    console.log(`  device ${v.deviceId}: ${v.modelledLitresRemaining} L modelled (${v.projectionQuality}, ${v.efficiencySource}, anchor ${v.anchorRefuelId})`
      + (v.telemetryLitresRemaining != null ? ` vs telemetry ${v.telemetryLitresRemaining} L` : ''));
  }
  console.log(`Report written: ${outFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
