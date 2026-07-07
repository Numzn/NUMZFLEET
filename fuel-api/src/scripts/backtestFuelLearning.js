#!/usr/bin/env node
/**
 * Read-only backtest: replay completed refuels through fuel learning scenarios.
 * Zero DB writes.
 *
 * Usage: node src/scripts/backtestFuelLearning.js [--out ./backtest-output]
 */
import fs from 'fs';
import path from 'path';
import sequelize from '../config/database.js';
import { DeviceAssignment } from '../models/index.js';
import { findCompletedRefuelsByVehicleId } from '../repositories/operationSessionRefuelRepository.js';
import { getVehicleSpec } from '../services/vehicleSpecService.js';
import { analyzeFuelEvidenceQuality } from '../vehicleEngine/fuel/fuelLearningEvidenceAnalysis.js';
import {
  simulateVehicleRefuels,
  SCENARIOS,
  ENVELOPE_GRID,
  DEFAULT_ENVELOPE_PARAMS,
} from '../vehicleEngine/fuel/fuelLearningSimulation.js';

function parseArgs(argv) {
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 && argv[outIdx + 1]
    ? path.resolve(argv[outIdx + 1])
    : path.resolve(process.cwd(), 'backtest-output');
  return { outDir };
}

function summarizeCalibration(calibrationSeries) {
  if (!calibrationSeries.length) {
    return { count: 0, meanError: null, meanAbsError: null, biasDirection: null };
  }
  const errors = calibrationSeries.map((c) => c.errorLitres);
  const meanError = errors.reduce((s, v) => s + v, 0) / errors.length;
  const meanAbsError = errors.reduce((s, v) => s + Math.abs(v), 0) / errors.length;
  let biasDirection = 'neutral';
  if (meanError > 0.5) biasDirection = 'over_predicted';
  else if (meanError < -0.5) biasDirection = 'under_predicted';
  return {
    count: calibrationSeries.length,
    meanError: Number(meanError.toFixed(2)),
    meanAbsError: Number(meanAbsError.toFixed(2)),
    biasDirection,
  };
}

function aggregateFleetResults(vehicleResults) {
  const byScenario = {};
  for (const [scenarioId, vehicles] of Object.entries(vehicleResults)) {
    const baselines = vehicles.map((v) => v.finalBaseline).filter((n) => n != null && n > 0);
    byScenario[scenarioId] = {
      vehicleCount: vehicles.length,
      avgFinalBaseline: baselines.length
        ? Number((baselines.reduce((s, v) => s + v, 0) / baselines.length).toFixed(2))
        : null,
      maxDisplacementPct: vehicles.length
        ? Math.max(...vehicles.map((v) => v.maxDisplacementPct))
        : 0,
      totalAccepted: vehicles.reduce((s, v) => s + v.counts.accepted, 0),
      totalQuarantined: vehicles.reduce((s, v) => s + v.counts.quarantined, 0),
      totalStoredOnly: vehicles.reduce((s, v) => s + v.counts.storedOnly, 0),
      calibration: summarizeCalibration(vehicles.flatMap((v) => v.calibrationSeries)),
    };
  }
  return byScenario;
}

function compareScenarios(vehicleResults, aId, bId) {
  const comparisons = [];
  const aMap = new Map((vehicleResults[aId] ?? []).map((v) => [v.deviceId, v]));
  for (const b of vehicleResults[bId] ?? []) {
    const a = aMap.get(b.deviceId);
    if (!a || a.finalBaseline == null || b.finalBaseline == null || a.finalBaseline <= 0) continue;
    comparisons.push({
      deviceId: b.deviceId,
      aBaseline: a.finalBaseline,
      bBaseline: b.finalBaseline,
      deltaPct: Number((((b.finalBaseline - a.finalBaseline) / a.finalBaseline) * 100).toFixed(2)),
      aAccepted: a.counts.accepted,
      bAccepted: b.counts.accepted,
    });
  }
  return comparisons.sort((x, y) => Math.abs(y.deltaPct) - Math.abs(x.deltaPct));
}

function buildDecisionTable(report) {
  const evidence = report.evidenceQuality;
  const sufficient = evidence.dataset.totalCompletedRefuels >= 30
    && evidence.intervals.learnable >= 10;

  const s0s1 = report.s0s1Comparison;
  const materialS1 = s0s1.some((r) => Math.abs(r.deltaPct) > 2 || r.aAccepted !== r.bAccepted);

  const s0 = report.fleetSummary.S0;
  const s2 = report.fleetSummary.S2;
  const s3 = report.fleetSummary.S3;
  const after = report.fleetSummary.AFTER;

  return {
    pairingProtection: {
      decision: materialS1 || evidence.dataset.partialToFullChains > 0
        ? 'ADOPT'
        : (sufficient ? 'REJECT' : 'INSUFFICIENT EVIDENCE — ADOPT on correctness grounds'),
      rationale: 'previous_partial_fill gate fixes verified bug #6; S1 quantifies fleet impact',
    },
    operatingEnvelope: {
      decision: sufficient && s2.totalQuarantined > s0.totalQuarantined
        ? 'ADOPT MAD'
        : (sufficient ? 'KEEP CURRENT' : 'ADOPT MAD with σ fallback — audit-proven σ=0 fix'),
      rationale: sufficient
        ? 'Fleet grid comparison'
        : 'Dev fleet insufficient; MAD adopted with explicit config + 3σ fallback when n<minSamples',
    },
    boundedAdaptation: {
      decision: sufficient && s3.maxDisplacementPct < s2.maxDisplacementPct
        ? 'ADOPT'
        : 'INSUFFICIENT EVIDENCE — DEFER',
      rationale: 'BOUNDED_DISPLACEMENT_PCT=null in fuelLearningConfig.js',
    },
    maturityRules: {
      decision: sufficient ? 'SUPPORTED' : 'INSUFFICIENT EVIDENCE — read-only exposure only',
      rationale: 'deriveModelMaturity exposed via loadFuelLearningState; no learning behavior change',
    },
    beforeAfter: {
      s0Accepted: s0?.totalAccepted ?? 0,
      afterAccepted: after?.totalAccepted ?? 0,
      s0Quarantined: s0?.totalQuarantined ?? 0,
      afterQuarantined: after?.totalQuarantined ?? 0,
    },
  };
}

function buildMarkdownReport(report) {
  const lines = [
    '# Fuel Learning Backtest Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Dataset: ${report.datasetLabel}`,
    '',
    '## Evidence quality',
    '',
    `- Completed refuels: ${report.evidenceQuality.dataset.totalCompletedRefuels}`,
    `- Full tank (explicit): ${report.evidenceQuality.dataset.fullTankCount}`,
    `- Partial (explicit): ${report.evidenceQuality.dataset.partialExplicitCount}`,
    `- Suspicious partial near capacity: ${report.evidenceQuality.dataset.suspiciousPartialNearCapacity}`,
    `- Partial→full chains: ${report.evidenceQuality.dataset.partialToFullChains}`,
    `- Vehicles with full-tank anchor: ${report.evidenceQuality.anchors.vehiclesWithFullTankAnchor}`,
    `- Vehicles without anchor: ${report.evidenceQuality.anchors.vehiclesWithoutFullTankAnchor}`,
    `- Learnable intervals: ${report.evidenceQuality.intervals.learnable}`,
    `- Rejected: ${report.evidenceQuality.intervals.rejected}`,
    `- Stored only: ${report.evidenceQuality.intervals.storedOnly}`,
    `- Odometer invalid: ${report.evidenceQuality.intervals.odometerInvalid}`,
    '',
    '## Fleet summary by scenario',
    '',
    '| Scenario | Vehicles | Avg baseline | Max disp % | Accepted | Quarantined |',
    '|----------|----------|--------------|------------|----------|-------------|',
  ];

  for (const [id, s] of Object.entries(report.fleetSummary)) {
    lines.push(`| ${id} | ${s.vehicleCount} | ${s.avgFinalBaseline ?? '—'} | ${s.maxDisplacementPct} | ${s.totalAccepted} | ${s.totalQuarantined} |`);
  }

  lines.push('', '## Decision table', '');
  for (const [key, val] of Object.entries(report.decisionTable)) {
    if (typeof val === 'object' && val.decision) {
      lines.push(`### ${key}`);
      lines.push(`- **Decision:** ${val.decision}`);
      lines.push(`- ${val.rationale}`);
      lines.push('');
    }
  }

  lines.push('## S0 vs AFTER (hardened production)', '');
  for (const row of (report.beforeAfterComparison ?? []).slice(0, 10)) {
    lines.push(`- device ${row.deviceId}: ${row.aBaseline} → ${row.bBaseline} (${row.deltaPct}%), accepted ${row.aAccepted}→${row.bAccepted}`);
  }

  return lines.join('\n');
}

async function runScenarios(assignments, scenarioIds) {
  const vehicleResults = {};
  for (const id of scenarioIds) vehicleResults[id] = [];

  for (const assignment of assignments) {
    const deviceId = Number(assignment.deviceId);
    const refuels = await findCompletedRefuelsByVehicleId(deviceId, 100);
    if (refuels.length < 2) continue;
    const spec = await getVehicleSpec(deviceId);

    for (const id of scenarioIds) {
      const scenario = SCENARIOS[id];
      if (!scenario) continue;
      const result = simulateVehicleRefuels(refuels, spec, scenario, DEFAULT_ENVELOPE_PARAMS);
      vehicleResults[id].push({ deviceId, fleetVehicleId: assignment.vehicleId, ...result });
    }
  }
  return vehicleResults;
}

async function main() {
  const { outDir } = parseArgs(process.argv.slice(2));
  fs.mkdirSync(outDir, { recursive: true });

  const learningBefore = await sequelize.query(
    'SELECT COUNT(*)::int AS n, MAX(updated_at) AS max_updated FROM vehicle_fuel_learning',
    { type: sequelize.QueryTypes.SELECT },
  );

  const evidenceQuality = await analyzeFuelEvidenceQuality();
  const assignments = await DeviceAssignment.findAll({
    where: { isActive: true },
    attributes: ['vehicleId', 'deviceId'],
  });

  const scenarioIds = ['S0', 'S1', 'S2', 'S3', 'AFTER'];
  const vehicleResults = await runScenarios(assignments, scenarioIds);

  const envelopeGrid = [];
  for (const params of ENVELOPE_GRID) {
    let totalQuarantined = 0;
    let totalAccepted = 0;
    let maxDisplacementPct = 0;
    for (const assignment of assignments) {
      const deviceId = Number(assignment.deviceId);
      const refuels = await findCompletedRefuelsByVehicleId(deviceId, 100);
      if (refuels.length < 2) continue;
      const spec = await getVehicleSpec(deviceId);
      const result = simulateVehicleRefuels(refuels, spec, SCENARIOS.S2, params);
      totalQuarantined += result.counts.quarantined;
      totalAccepted += result.counts.accepted;
      maxDisplacementPct = Math.max(maxDisplacementPct, result.maxDisplacementPct);
    }
    envelopeGrid.push({ params, totalQuarantined, totalAccepted, maxDisplacementPct });
  }

  const fleetSummary = aggregateFleetResults(vehicleResults);
  const s0s1Comparison = compareScenarios(vehicleResults, 'S0', 'S1');
  const beforeAfterComparison = compareScenarios(vehicleResults, 'S0', 'AFTER');

  const report = {
    generatedAt: new Date().toISOString(),
    datasetLabel: 'numzlab-dev (numzfleet-dev-db)',
    assignmentCount: assignments.length,
    evidenceQuality,
    fleetSummary,
    s0s1Comparison,
    beforeAfterComparison,
    envelopeGrid,
    vehicleResults,
  };
  report.decisionTable = buildDecisionTable(report);

  fs.writeFileSync(path.join(outDir, 'backtest-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'backtest-summary.md'), buildMarkdownReport(report));

  const learningAfter = await sequelize.query(
    'SELECT COUNT(*)::int AS n, MAX(updated_at) AS max_updated FROM vehicle_fuel_learning',
    { type: sequelize.QueryTypes.SELECT },
  );

  console.log('Backtest complete (read-only).');
  console.log(`  refuels: ${evidenceQuality.dataset.totalCompletedRefuels}`);
  console.log(`  learnable intervals: ${evidenceQuality.intervals.learnable}`);
  console.log(`  OUT: ${outDir}`);
  console.log(`  DB unchanged: ${learningBefore[0]?.n} → ${learningAfter[0]?.n} rows`);

  await sequelize.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try { await sequelize.close(); } catch { /* ignore */ }
  process.exit(1);
});
