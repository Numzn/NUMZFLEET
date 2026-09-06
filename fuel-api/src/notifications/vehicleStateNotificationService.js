import { publishNotification } from './orchestrator/publishNotification.js';
import { getNotificationIo } from './notificationContext.js';
import {
  vehicleGpsLostPolicy,
  vehicleGpsRecoveredPolicy,
  vehicleExtendedOfflinePolicy,
  vehicleExcessiveIdlePolicy,
} from './policies/notificationPolicyRegistry.js';

function vehicleLabel(vehicle) {
  if (!vehicle) return 'Vehicle';
  return vehicle.plateNumber || vehicle.name || 'Vehicle';
}

function formatDuration(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

async function publish(policy, { title, message, fleetVehicleId, deviceId, companyId, extraMetadata }) {
  const io = getNotificationIo();
  await publishNotification({
    type: policy.type,
    entityType: policy.entityType,
    entityId: String(fleetVehicleId),
    severity: policy.severity,
    urgency: policy.urgency,
    title,
    message,
    source: 'fuel-api',
    companyId,
    audience: policy.audience,
    metadata: {
      fleetVehicleId,
      deviceId,
      observedAt: new Date().toISOString(),
      ...extraMetadata,
    },
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
  }, { io });
}

/**
 * Vehicle just transitioned into 'offline' (was moving/idle last sweep).
 * One-shot per transition — not a repeat while it stays offline (see
 * notifyVehicleExtendedOffline for that).
 */
export async function notifyVehicleGpsLost({ fleetVehicleId, deviceId, stateEnteredAt, vehicle = null, companyId = null }) {
  if (!fleetVehicleId || !stateEnteredAt) return;
  const policy = vehicleGpsLostPolicy({ fleetVehicleId, stateEnteredAt: new Date(stateEnteredAt).toISOString() });
  await publish(policy, {
    title: 'Vehicle connectivity lost',
    message: `${vehicleLabel(vehicle)} has gone offline`,
    fleetVehicleId,
    deviceId,
    companyId,
    extraMetadata: { plateNumber: vehicle?.plateNumber ?? null, vehicleName: vehicle?.name ?? null },
  });
}

/** Vehicle just transitioned OUT of 'offline' (recovered connectivity). */
export async function notifyVehicleGpsRecovered({ fleetVehicleId, deviceId, stateEnteredAt, vehicle = null, companyId = null }) {
  if (!fleetVehicleId || !stateEnteredAt) return;
  const policy = vehicleGpsRecoveredPolicy({ fleetVehicleId, stateEnteredAt: new Date(stateEnteredAt).toISOString() });
  await publish(policy, {
    title: 'Vehicle connectivity restored',
    message: `${vehicleLabel(vehicle)} is back online`,
    fleetVehicleId,
    deviceId,
    companyId,
    extraMetadata: { plateNumber: vehicle?.plateNumber ?? null, vehicleName: vehicle?.name ?? null },
  });
}

/** Vehicle has been continuously 'offline' for longer than the configured threshold. */
export async function notifyVehicleExtendedOffline({ fleetVehicleId, deviceId, durationMs, vehicle = null, companyId = null }) {
  if (!fleetVehicleId) return;
  const policy = vehicleExtendedOfflinePolicy({ fleetVehicleId });
  await publish(policy, {
    title: 'Vehicle offline for an extended period',
    message: `${vehicleLabel(vehicle)} has been offline for ${formatDuration(durationMs)}`,
    fleetVehicleId,
    deviceId,
    companyId,
    extraMetadata: {
      plateNumber: vehicle?.plateNumber ?? null,
      vehicleName: vehicle?.name ?? null,
      durationMs,
    },
  });
}

/** Vehicle has been continuously 'idle' for longer than the configured threshold. */
export async function notifyVehicleExcessiveIdle({ fleetVehicleId, deviceId, durationMs, vehicle = null, companyId = null }) {
  if (!fleetVehicleId) return;
  const policy = vehicleExcessiveIdlePolicy({ fleetVehicleId });
  await publish(policy, {
    title: 'Vehicle idling for an extended period',
    message: `${vehicleLabel(vehicle)} has been idle for ${formatDuration(durationMs)}`,
    fleetVehicleId,
    deviceId,
    companyId,
    extraMetadata: {
      plateNumber: vehicle?.plateNumber ?? null,
      vehicleName: vehicle?.name ?? null,
      durationMs,
    },
  });
}

export { formatDuration };
