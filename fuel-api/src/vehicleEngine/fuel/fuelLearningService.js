import {
  VehicleFuelLearning,
  VehicleFuelInterval,
  DeviceAssignment,
} from '../../models/index.js';
import { findCompletedRefuelsByVehicleId } from '../../repositories/operationSessionRefuelRepository.js';
import { getVehicleSpec } from '../../services/vehicleSpecService.js';
import { validateInterval } from './intervalValidator.js';
import { buildIntervalFromRefuels } from './intervalBuilder.js';
import { applyLearningUpdate } from './learningEngine.js';
import { resolveChronologicalPreviousRefuel } from './fuelLearningPairing.js';
import {
  gateEfficiencyObservation,
  classifyEvidence,
  EVIDENCE_CLASS,
} from './fuelEvidenceClassifier.js';
import {
  ENVELOPE_GATING,
  REFUEL_PAIRING_LOOKBACK,
  MATURITY_PARAMS,
} from './fuelLearningConfig.js';
import { computeOperatingEnvelope } from './fuelOperatingEnvelope.js';
import { deriveModelMaturity } from './fuelModelMaturity.js';

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

  const recentIntervals = await VehicleFuelInterval.findAll({
    where: { fleetVehicleId },
    order: [['eventAt', 'DESC']],
    limit: MATURITY_PARAMS.recentWindow ?? 10,
  });

  const learningState = {
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

  const envelope = computeOperatingEnvelope(learningState.efficiencyHistory, {
    method: ENVELOPE_GATING.method,
    madMultiplier: ENVELOPE_GATING.madMultiplier,
    minSamples: ENVELOPE_GATING.minSamples,
  });

  const maturityResult = deriveModelMaturity({
    learningState,
    recentIntervals: recentIntervals.map((iv) => ({
      validationStatus: iv.validationStatus,
      isAnomalous: iv.isAnomalous,
      quarantined: iv.isAnomalous || iv.validationStatus === 'STORED_ONLY',
      envelopeRejected: iv.isAnomalous,
      accepted: iv.validationStatus === 'LEARNABLE' && !iv.isAnomalous,
      efficiencyKmL: iv.efficiencyKmL != null ? Number(iv.efficiencyKmL) : null,
    })),
    envelope,
    params: MATURITY_PARAMS,
  });

  return {
    ...learningState,
    modelMaturity: maturityResult.state,
    maturitySignals: maturityResult.signals,
    operatingEnvelope: envelope.available ? {
      center: envelope.center,
      lowerBound: envelope.lowerBound,
      upperBound: envelope.upperBound,
      method: envelope.method,
      sampleSize: envelope.sampleSize,
    } : null,
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

  const rows = await findCompletedRefuelsByVehicleId(devId, REFUEL_PAIRING_LOOKBACK);
  const previousRow = resolveChronologicalPreviousRefuel(rows, refuel.id);

  if (!previousRow) return null;

  const spec = await getVehicleSpec(Number(devId));
  const validation = validateInterval({
    previous: previousRow,
    current: refuel,
    tankCapacity: spec?.tankCapacity ?? refuel.tankCapacitySnapshot,
    specEfficiencyKmL: spec?.fuelEfficiency ?? null,
  });

  const intervalData = buildIntervalFromRefuels(previousRow, refuel, validation);

  let learningRow = await VehicleFuelLearning.findByPk(fleetId, { transaction });
  const history = learningRow?.efficiencyHistory ?? [];

  const gateResult = validation.efficiencyKmL != null
    ? gateEfficiencyObservation(validation.efficiencyKmL, history, ENVELOPE_GATING)
    : { isAnomalous: false, reason: null, gate: 'none' };

  const evidence = classifyEvidence({ validation, gateResult });

  const interval = await VehicleFuelInterval.create({
    fleetVehicleId: fleetId,
    refuelId: refuel.id,
    previousRefuelId: previousRow.id,
    distanceKm: intervalData.distanceKm,
    litresConsumed: intervalData.litresConsumed,
    efficiencyKmL: intervalData.efficiencyKmL,
    validationStatus: intervalData.validationStatus,
    isAnomalous: evidence.evidenceClass === EVIDENCE_CLASS.OUTLIER,
    eventAt: intervalData.eventAt,
  }, { transaction });

  if (evidence.shouldLearn && validation.efficiencyKmL != null) {
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

  return {
    interval,
    learning: learningRow,
    validationStatus: validation.status,
    evidenceClass: evidence.evidenceClass,
    gate: gateResult.gate ?? null,
  };
}

export default {
  resolveFleetVehicleIdForDevice,
  loadFuelLearningState,
  processFuelLearningOnRefuelComplete,
};
