import {
  VehicleFuelLearning,
  VehicleFuelInterval,
  DeviceAssignment,
} from '../../models/index.js';
import { findCompletedRefuelsByVehicleId } from '../../repositories/operationSessionRefuelRepository.js';
import { getVehicleSpec } from '../../services/vehicleSpecService.js';
import { validateInterval, INTERVAL_STATUS } from './intervalValidator.js';
import { buildIntervalFromRefuels, isLearnableInterval } from './intervalBuilder.js';
import { detectEfficiencyAnomaly } from './anomalyDetector.js';
import { applyLearningUpdate } from './learningEngine.js';

export async function resolveFleetVehicleIdForDevice(deviceId) {
  if (deviceId == null) return null;
  const assignment = await DeviceAssignment.findOne({
    where: { deviceId: Number(deviceId), isActive: true },
    order: [['assignedAt', 'DESC']],
  });
  return assignment?.vehicleId ?? null;
}

export async function loadFuelLearningState(fleetVehicleId) {
  if (!fleetVehicleId) return null;
  const row = await VehicleFuelLearning.findByPk(fleetVehicleId);
  if (!row) return null;
  const plain = row.get({ plain: true });
  return {
    fleetVehicleId: plain.fleetVehicleId,
    deviceId: plain.deviceId,
    currentEfficiency: plain.currentEfficiency != null ? Number(plain.currentEfficiency) : null,
    specEfficiency: plain.specEfficiency != null ? Number(plain.specEfficiency) : null,
    confidence: plain.confidence ?? 0,
    trend: plain.trend ?? 'stable',
    totalObservations: plain.totalObservations ?? 0,
    totalDistanceKm: plain.totalDistanceKm != null ? Number(plain.totalDistanceKm) : 0,
    efficiencyHistory: plain.efficiencyHistory ?? [],
    lastIntervalAt: plain.lastIntervalAt ?? null,
  };
}

/**
 * Process fuel learning when a refuel is completed.
 */
export async function processFuelLearningOnRefuelComplete({
  refuel,
  fleetVehicleId = null,
  deviceId = null,
  transaction = null,
}) {
  const devId = deviceId ?? refuel?.vehicleId;
  const fleetId = fleetVehicleId ?? await resolveFleetVehicleIdForDevice(devId);
  if (!fleetId || !refuel?.id) return null;

  const existingInterval = await VehicleFuelInterval.findOne({
    where: { refuelId: Number(refuel.id) },
    transaction,
  });
  if (existingInterval) return existingInterval;

  const rows = await findCompletedRefuelsByVehicleId(devId, 10);
  const sorted = [...rows].sort(
    (a, b) => new Date(b.sessionDate || b.createdAt) - new Date(a.sessionDate || a.createdAt),
  );
  const curIdx = sorted.findIndex((r) => Number(r.id) === Number(refuel.id));
  const previousRow = curIdx >= 0 ? sorted[curIdx + 1] : sorted[1];

  if (!previousRow) return null;

  const spec = await getVehicleSpec(Number(devId));
  const validation = validateInterval({
    previous: previousRow,
    current: refuel,
    tankCapacity: spec?.tankCapacity ?? refuel.tankCapacitySnapshot,
    specEfficiencyKmL: spec?.fuelEfficiency ?? null,
  });

  const intervalData = buildIntervalFromRefuels(previousRow, refuel, validation);
  const anomaly = validation.efficiencyKmL != null
    ? detectEfficiencyAnomaly(validation.efficiencyKmL, [])
    : { isAnomalous: false };

  let learningRow = await VehicleFuelLearning.findByPk(fleetId, { transaction });
  const history = learningRow?.efficiencyHistory ?? [];
  const anomalyCheck = validation.efficiencyKmL != null
    ? detectEfficiencyAnomaly(validation.efficiencyKmL, history)
    : anomaly;

  const interval = await VehicleFuelInterval.create({
    fleetVehicleId: fleetId,
    refuelId: refuel.id,
    previousRefuelId: previousRow.id,
    distanceKm: intervalData.distanceKm,
    litresConsumed: intervalData.litresConsumed,
    efficiencyKmL: intervalData.efficiencyKmL,
    validationStatus: intervalData.validationStatus,
    isAnomalous: anomalyCheck.isAnomalous,
    eventAt: intervalData.eventAt,
  }, { transaction });

  const shouldLearn = isLearnableInterval(validation) && !anomalyCheck.isAnomalous;
  if (shouldLearn && validation.efficiencyKmL != null) {
    const priorState = learningRow
      ? {
        currentEfficiency: learningRow.currentEfficiency,
        confidence: learningRow.confidence,
        trend: learningRow.trend,
        totalObservations: learningRow.totalObservations,
        totalDistanceKm: learningRow.totalDistanceKm,
        efficiencyHistory: learningRow.efficiencyHistory ?? [],
      }
      : {
        currentEfficiency: spec?.fuelEfficiency ?? null,
        confidence: 0,
        trend: 'stable',
        totalObservations: 0,
        totalDistanceKm: 0,
        efficiencyHistory: [],
      };

    const updated = applyLearningUpdate(priorState, validation.efficiencyKmL, {
      distanceKm: validation.distanceKm,
      eventAt: intervalData.eventAt,
    });

    const payload = {
      fleetVehicleId: fleetId,
      deviceId: Number(devId),
      currentEfficiency: updated.currentEfficiency,
      specEfficiency: spec?.fuelEfficiency ?? null,
      confidence: updated.confidence,
      trend: updated.trend,
      totalObservations: updated.totalObservations,
      totalDistanceKm: updated.totalDistanceKm,
      efficiencyHistory: updated.efficiencyHistory,
      lastIntervalAt: updated.lastIntervalAt,
      updated_at: new Date(),
    };

    if (learningRow) {
      await learningRow.update(payload, { transaction });
    } else {
      learningRow = await VehicleFuelLearning.create(payload, { transaction });
    }
  } else if (!learningRow) {
    learningRow = await VehicleFuelLearning.create({
      fleetVehicleId: fleetId,
      deviceId: Number(devId),
      specEfficiency: spec?.fuelEfficiency ?? null,
      confidence: 0,
      trend: 'stable',
      totalObservations: 0,
      totalDistanceKm: 0,
      efficiencyHistory: [],
    }, { transaction });
  }

  return { interval, learning: learningRow, validationStatus: validation.status };
}

export default {
  resolveFleetVehicleIdForDevice,
  loadFuelLearningState,
  processFuelLearningOnRefuelComplete,
};
