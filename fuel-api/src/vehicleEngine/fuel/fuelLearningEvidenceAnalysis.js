/**
 * Fuel refuel evidence quality analysis (read-only DB queries).
 */
import { Op } from 'sequelize';
import { OperationSessionRefuel, DeviceAssignment } from '../../models/index.js';
import { validateInterval, INTERVAL_STATUS } from './intervalValidator.js';
import { isLearnableInterval } from './intervalBuilder.js';
import { gateEfficiencyObservation } from './fuelEvidenceClassifier.js';
import { ENVELOPE_GATING } from './fuelLearningConfig.js';
import { getVehicleSpec } from '../../services/vehicleSpecService.js';
import { resolveChronologicalPreviousRefuel } from './fuelLearningPairing.js';
import { findCompletedRefuelsByVehicleId } from '../../repositories/operationSessionRefuelRepository.js';
import {
  isConfirmedFull,
  isConfirmedPartial,
} from './fuelFillClassification.js';

const SUSPICIOUS_PARTIAL_CAPACITY_RATIO = 0.9;

function isSuspiciousPartial(row) {
  if (!isConfirmedPartial(row)) return false;
  const litres = Number(row.actualFuelLitres);
  const cap = Number(row.tankCapacitySnapshot);
  if (!Number.isFinite(litres) || !Number.isFinite(cap) || cap <= 0) return false;
  return litres / cap >= SUSPICIOUS_PARTIAL_CAPACITY_RATIO;
}

/**
 * Analyze fleet refuel evidence quality.
 */
export async function analyzeFuelEvidenceQuality(options = {}) {
  const lookback = options.lookback ?? 100;

  const completed = await OperationSessionRefuel.findAll({
    where: { actualFuelLitres: { [Op.gt]: 0 } },
    order: [['sessionDate', 'ASC']],
  });

  const fullTank = completed.filter((r) => isConfirmedFull(r));
  const partialExplicit = completed.filter((r) => isConfirmedPartial(r));
  const suspiciousPartial = completed.filter(isSuspiciousPartial);

  const assignments = await DeviceAssignment.findAll({
    where: { isActive: true },
    attributes: ['vehicleId', 'deviceId'],
  });

  const deviceIds = [...new Set(completed.map((r) => Number(r.vehicleId)))];

  let partialToFullChains = 0;
  let learnable = 0;
  let rejected = 0;
  let storedOnly = 0;
  let flagged = 0;
  let anomalous = 0;
  let odometerInvalid = 0;

  const vehiclesWithAnchors = new Set();
  const vehiclesWithoutAnchors = new Set();

  for (const deviceId of deviceIds) {
    const refuels = await findCompletedRefuelsByVehicleId(deviceId, lookback);
    const hasFullTank = refuels.some((r) => isConfirmedFull(r));
    if (hasFullTank) vehiclesWithAnchors.add(deviceId);
    else if (refuels.length > 0) vehiclesWithoutAnchors.add(deviceId);

    const spec = await getVehicleSpec(Number(deviceId));

    const sorted = [...refuels].sort(
      (a, b) => new Date(a.sessionDate || a.createdAt) - new Date(b.sessionDate || b.createdAt),
    );

    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1];
      const current = sorted[i];

      if (isConfirmedPartial(previous) && !isConfirmedPartial(current) && isConfirmedFull(current)) {
        partialToFullChains += 1;
      }

      const validation = validateInterval({
        previous,
        current,
        tankCapacity: spec?.tankCapacity ?? current.tankCapacitySnapshot,
        specEfficiencyKmL: spec?.fuelEfficiency ?? null,
      });

      if (validation.reason === 'odometer_backwards' || validation.reason === 'missing_mileage') {
        odometerInvalid += 1;
      }

      if (validation.status === INTERVAL_STATUS.REJECTED) rejected += 1;
      else if (validation.status === INTERVAL_STATUS.FLAGGED) flagged += 1;
      else if (validation.status === INTERVAL_STATUS.STORED_ONLY) storedOnly += 1;
      else if (isLearnableInterval(validation)) {
        learnable += 1;
        const gate = gateEfficiencyObservation(
          validation.efficiencyKmL,
          [],
          ENVELOPE_GATING,
        );
        if (gate.isAnomalous) anomalous += 1;
      }
    }
  }

  return {
    dataset: {
      totalCompletedRefuels: completed.length,
      fullTankCount: fullTank.length,
      partialExplicitCount: partialExplicit.length,
      suspiciousPartialNearCapacity: suspiciousPartial.length,
      partialToFullChains,
      activeAssignments: assignments.length,
      distinctVehicles: deviceIds.length,
    },
    anchors: {
      vehiclesWithFullTankAnchor: vehiclesWithAnchors.size,
      vehiclesWithoutFullTankAnchor: vehiclesWithoutAnchors.size,
      vehicleIdsWithAnchor: [...vehiclesWithAnchors],
      vehicleIdsWithoutAnchor: [...vehiclesWithoutAnchors],
    },
    intervals: {
      learnable,
      rejected,
      storedOnly,
      flagged,
      anomalousAtGate: anomalous,
      odometerInvalid,
    },
  };
}

export default { analyzeFuelEvidenceQuality };
