import { Op } from 'sequelize';
import {
  Vehicle,
  DeviceAssignment,
  VehicleImmobilizationIntent,
} from '../models/index.js';
import {
  getTraccarDevicesByIds,
  getTraccarLatestPositionsByDeviceIds,
} from '../config/traccar.js';
import {
  evaluateGates,
  buildTelemetrySnapshot,
  intentExpiresAt,
  IMMOBILIZE_ACTION,
  MOBILIZE_ACTION,
} from '../immobilization/safetyContract.js';
import {
  fetchCommandTypes,
  sendDeviceCommand,
  resolveCommandTypeForAction,
  isTraccarCommandApiConfigured,
} from './traccarCommandService.js';
import {
  tryClaimIntentForExecution,
  recordTraccarDeliveryAccepted,
  finalizeExecutingIntent,
} from '../immobilization/executionClaim.js';
import { reconcileStuckExecuting } from '../immobilization/executionRecovery.js';
import {
  probeDeviceCommandOutcome,
  probeRecentSentIntents,
} from '../immobilization/deviceCommandOutcomeProbe.js';
import { logImmobilization } from '../immobilization/immobilizationLog.js';
import sequelize from '../config/database.js';

const ACTIVE_STATUSES = ['pending', 'monitoring', 'executing'];
const CANCELLABLE_STATUSES = ['pending', 'monitoring'];

export function serializeIntent(row) {
  if (!row) return null;
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    vehicleId: plain.vehicleId,
    deviceId: plain.deviceId,
    action: plain.action,
    status: plain.status,
    createdByUserId: plain.createdByUserId,
    cancelledByUserId: plain.cancelledByUserId,
    expiresAt: plain.expiresAt,
    gateSnapshot: plain.gateSnapshot || {},
    traccarCommandType: plain.traccarCommandType,
    executionStartedAt: plain.executionStartedAt,
    executionCompletedAt: plain.executionCompletedAt,
    executionError: plain.executionError,
    executionAttempt: plain.executionAttempt ?? 0,
    traccarDeliveryAt: plain.traccarDeliveryAt,
    traccarHttpStatus: plain.traccarHttpStatus,
    deliveryPhase: plain.deliveryPhase,
    confidence: plain.confidence,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

export { reconcileStuckExecuting };

async function getActiveAssignment(vehicleId) {
  return DeviceAssignment.findOne({
    where: { vehicleId, isActive: true, unassignedAt: null },
  });
}

async function loadTelemetryForDevice(deviceId) {
  const [devices, positions] = await Promise.all([
    getTraccarDevicesByIds([deviceId]),
    getTraccarLatestPositionsByDeviceIds([deviceId]),
  ]);
  const device = devices[0] || { status: 'offline' };
  const position = positions.find((p) => Number(p.deviceId) === Number(deviceId)) || null;
  return buildTelemetrySnapshot(device, position);
}

/**
 * @param {number} deviceId
 * @param {'immobilize'|'mobilize'} action
 */
export async function getCapabilitiesForDevice(deviceId) {
  if (!isTraccarCommandApiConfigured()) {
    return {
      commandApiConfigured: false,
      canImmobilize: false,
      canMobilize: false,
      types: [],
      blockedReason: 'traccar_command_api_not_configured',
    };
  }
  try {
    const types = await fetchCommandTypes(deviceId);
    const imm = resolveCommandTypeForAction(IMMOBILIZE_ACTION, types);
    const mob = resolveCommandTypeForAction(MOBILIZE_ACTION, types);
    const canImmobilize = imm.supported;
    const canMobilize = mob.supported;
    return {
      commandApiConfigured: true,
      canImmobilize,
      canMobilize,
      types: types.map((t) => t.type),
      blockedReason: canImmobilize || canMobilize ? null : 'protocol_unsupported',
      immobilizeReason: imm.reason,
      mobilizeReason: mob.reason,
    };
  } catch (e) {
    if (e.authFailed || e.statusCode === 401 || e.statusCode === 403) {
      return {
        commandApiConfigured: true,
        canImmobilize: false,
        canMobilize: false,
        types: [],
        blockedReason: 'traccar_service_account_auth_failed',
        capabilityCheckError: null,
      };
    }
    return {
      commandApiConfigured: true,
      canImmobilize: false,
      canMobilize: false,
      types: [],
      blockedReason: 'capability_check_failed',
      capabilityCheckError: e.message || null,
    };
  }
}

export async function getActiveIntent(vehicleId) {
  const row = await VehicleImmobilizationIntent.findOne({
    where: { vehicleId, status: { [Op.in]: ACTIVE_STATUSES } },
    order: [['createdAt', 'DESC']],
  });
  return serializeIntent(row);
}

export async function getIntentHistory(vehicleId, limit = 20) {
  const rows = await VehicleImmobilizationIntent.findAll({
    where: { vehicleId },
    order: [['createdAt', 'DESC']],
    limit: Math.min(Math.max(1, limit), 100),
  });
  return rows.map(serializeIntent);
}

async function cancelActiveIntentsForVehicle(vehicleId, cancelledByUserId, reason, transaction) {
  const active = await VehicleImmobilizationIntent.findAll({
    where: { vehicleId, status: { [Op.in]: CANCELLABLE_STATUSES } },
    transaction,
  });
  for (const row of active) {
    row.status = 'cancelled';
    row.cancelledByUserId = cancelledByUserId;
    const snap = row.gateSnapshot && typeof row.gateSnapshot === 'object' ? row.gateSnapshot : {};
    row.gateSnapshot = { ...snap, cancelReason: reason };
    await row.save({ transaction });
  }
  return active.length;
}

/**
 * @param {string} vehicleId
 * @param {'immobilize'|'mobilize'} action
 * @param {{ id: number }} user
 */
export async function createIntent(vehicleId, action, user) {
  if (action !== IMMOBILIZE_ACTION && action !== MOBILIZE_ACTION) {
    const err = new Error('Invalid action');
    err.statusCode = 400;
    throw err;
  }

  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }

  const assignment = await getActiveAssignment(vehicleId);
  if (!assignment) {
    const err = new Error('No active device assignment for this vehicle');
    err.statusCode = 400;
    throw err;
  }

  const deviceId = Number(assignment.deviceId);
  const caps = await getCapabilitiesForDevice(deviceId, action);
  const resolved = resolveCommandTypeForAction(
    action,
    caps.types.map((type) => ({ type })),
  );

  if (!resolved.supported) {
    const err = new Error(
      action === IMMOBILIZE_ACTION
        ? 'This tracker does not support immobilization commands'
        : 'This tracker does not support mobilization commands',
    );
    err.statusCode = 400;
    err.code = resolved.reason;
    throw err;
  }

  if (!isTraccarCommandApiConfigured()) {
    const err = new Error('Traccar command API is not configured on the server');
    err.statusCode = 503;
    throw err;
  }

  if (action !== MOBILIZE_ACTION) {
    const existing = await VehicleImmobilizationIntent.findOne({
      where: { vehicleId, status: { [Op.in]: ACTIVE_STATUSES } },
    });
    if (existing) {
      const err = new Error('An immobilization request is already active for this vehicle');
      err.statusCode = 409;
      err.existingIntent = serializeIntent(existing);
      throw err;
    }
  }

  const snapshot = await loadTelemetryForDevice(deviceId);
  const priorTimer = {};
  const evaluation = evaluateGates({
    action,
    snapshot,
    timerState: priorTimer,
  });

  const intentPayload = {
    vehicleId,
    deviceId,
    action,
    status: 'pending',
    createdByUserId: user.id,
    expiresAt: intentExpiresAt(),
    gateSnapshot: {
      evaluation,
      timerState: evaluation.timerState,
    },
    traccarCommandType: resolved.commandType,
    traccarCommandPayload: { type: resolved.commandType, attributes: {} },
    confidence: 'unknown',
  };

  let intent;
  if (action === MOBILIZE_ACTION) {
    intent = await sequelize.transaction(async (t) => {
      await cancelActiveIntentsForVehicle(vehicleId, user.id, 'superseded_by_mobilize', t);
      return VehicleImmobilizationIntent.create(intentPayload, { transaction: t });
    });
  } else {
    intent = await VehicleImmobilizationIntent.create(intentPayload);
  }

  return serializeIntent(intent);
}

export async function cancelIntent(intentId, user, reason = 'operator_cancelled') {
  const row = await VehicleImmobilizationIntent.findByPk(intentId);
  if (!row) {
    const err = new Error('Intent not found');
    err.statusCode = 404;
    throw err;
  }
  if (row.status === 'executing') {
    const err = new Error('Cannot cancel while command delivery is in progress');
    err.statusCode = 409;
    throw err;
  }
  if (!CANCELLABLE_STATUSES.includes(row.status)) {
    const err = new Error('Intent is not active');
    err.statusCode = 400;
    throw err;
  }
  row.status = 'cancelled';
  row.cancelledByUserId = user.id;
  const snap = row.gateSnapshot && typeof row.gateSnapshot === 'object' ? row.gateSnapshot : {};
  row.gateSnapshot = { ...snap, cancelReason: reason };
  await row.save();
  return serializeIntent(row);
}

/**
 * Run one evaluation tick for all active intents (called by scheduler).
 */
export async function evaluateActiveIntents() {
  const tickStart = Date.now();
  if (!isTraccarCommandApiConfigured()) {
    return { evaluated: 0, executed: 0, skipped: 'not_configured' };
  }

  await reconcileStuckExecuting();

  const intents = await VehicleImmobilizationIntent.findAll({
    where: { status: { [Op.in]: ACTIVE_STATUSES } },
    order: [['createdAt', 'ASC']],
  });

  let executed = 0;
  let claimed = 0;
  for (const intent of intents) {
    try {
      const result = await evaluateOneIntent(intent);
      if (result?.claimed) claimed += 1;
      if (result?.delivered) executed += 1;
    } catch (e) {
      console.error('[immobilization] evaluate intent failed:', intent.id, e?.message || e);
    }
  }

  try {
    await probeRecentSentIntents();
  } catch (e) {
    console.warn('[immobilization] ack probe sweep failed:', e?.message || e);
  }

  logImmobilization('immobilization.evaluator.tick', {
    evaluated: intents.length,
    claimed,
    delivered: executed,
    durationMs: Date.now() - tickStart,
  });

  return { evaluated: intents.length, executed, claimed };
}

async function evaluateOneIntent(intent) {
  // 1. Expire
  const now = Date.now();
  if (new Date(intent.expiresAt).getTime() <= now) {
    intent.status = 'expired';
    await intent.save();
    return { claimed: false, delivered: false };
  }

  if (intent.status === 'executing') {
    return { claimed: false, delivered: false };
  }

  // 2. Evaluate gates
  const snapshot = await loadTelemetryForDevice(intent.deviceId);
  const priorSnap = intent.gateSnapshot && typeof intent.gateSnapshot === 'object'
    ? intent.gateSnapshot
    : {};
  const timerState = priorSnap.timerState || priorSnap.evaluation?.timerState || {};

  const evaluation = evaluateGates({
    action: intent.action,
    snapshot,
    timerState,
  });

  intent.gateSnapshot = {
    ...priorSnap,
    evaluation,
    timerState: evaluation.timerState,
    evaluatedAt: new Date().toISOString(),
  };

  if (intent.status === 'pending') {
    intent.status = 'monitoring';
  }

  if (!evaluation.authorized) {
    await intent.save();
    return { claimed: false, delivered: false };
  }

  await intent.save();

  // 3. Claim and deliver
  const { claimed, row: claimedRow } = await tryClaimIntentForExecution(intent.id);
  if (!claimed || !claimedRow) {
    return { claimed: false, delivered: false };
  }

  const assignment = await getActiveAssignment(intent.vehicleId);
  if (!assignment || Number(assignment.deviceId) !== Number(claimedRow.deviceId)) {
    await finalizeExecutingIntent(intent.id, {
      status: 'failed',
      executionError: 'device_reassigned',
      confidence: 'unverified',
      deliveryPhase: 'delivery_unknown',
    });
    return { claimed: true, delivered: false };
  }

  const commandType = claimedRow.traccarCommandType || claimedRow.traccarCommandPayload?.type;
  const payload = claimedRow.traccarCommandPayload || {};
  const attributes = payload.attributes || {};

  try {
    const delivery = await sendDeviceCommand(claimedRow.deviceId, {
      type: commandType,
      attributes,
    });
    await recordTraccarDeliveryAccepted(intent.id, {
      traccarHttpStatus: delivery.httpStatus ?? null,
    });
    const finalized = await finalizeExecutingIntent(intent.id, {
      status: 'completed',
      executionError: null,
      confidence: 'sent',
      deliveryPhase: 'http_accepted',
      traccarHttpStatus: delivery.httpStatus ?? null,
    });
    if (finalized) {
      try {
        await probeDeviceCommandOutcome(finalized);
      } catch (probeErr) {
        console.warn('[immobilization] ack probe failed:', intent.id, probeErr?.message || probeErr);
      }
    }
    return { claimed: true, delivered: true };
  } catch (e) {
    await finalizeExecutingIntent(intent.id, {
      status: 'failed',
      executionError: 'traccar_http_rejected',
      confidence: 'unverified',
      deliveryPhase: 'http_rejected',
      traccarHttpStatus: e.httpStatus ?? null,
    });
    return { claimed: true, delivered: false };
  }
}
