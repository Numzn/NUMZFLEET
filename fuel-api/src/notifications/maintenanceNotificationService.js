import { publishNotification } from './orchestrator/publishNotification.js';
import { getNotificationIo } from './notificationContext.js';
import { ROUTINE_SERVICE_LABEL } from '../maintenance/routineServiceStatus.js';
import {
  maintenanceCompletedPolicy,
  maintenanceRoutineStatePolicy,
  maintenanceRiskPolicy,
} from './policies/notificationPolicyRegistry.js';

function vehicleLabel(vehicle) {
  if (!vehicle) return 'Vehicle';
  return vehicle.plateNumber || vehicle.name || 'Vehicle';
}

function formatOdometer(km) {
  if (km == null || !Number.isFinite(Number(km))) return null;
  return `${Math.round(Number(km)).toLocaleString()} km`;
}

// A vehicle this far past due (km) gets its own, more severe notification
// tier rather than reading identically to one that just crossed into
// overdue. Same style as the engine's own upcoming/due_soon/prepare/due_now
// ladder (100/500/1000 km) — round numbers, not a tuned model.
const CRITICALLY_OVERDUE_KM = 500;

// Previously due_now/prepare/due_soon all collapsed into one 'due' bucket
// (same severity, same notification, regardless of whether a vehicle was
// 500km out or due today) and overdue had no escalation of its own. Each
// engine state (routineServiceStatus.js's RoutineServiceStatus) now maps to
// its own notification type, so severity actually tracks urgency:
//   upcoming/due_soon -> info, prepare/due_now/overdue -> warning,
//   critically overdue -> critical.
// 'due' is kept mapped (not produced by this function anymore, but still
// accepted) for exact backward compatibility with any existing caller/test.
export function mapRoutineStatusToType(status, remainingKm) {
  if (status === 'overdue') {
    return (Number.isFinite(remainingKm) && remainingKm <= -CRITICALLY_OVERDUE_KM)
      ? 'critically_overdue'
      : 'overdue';
  }
  if (status === 'due_now') return 'due_now';
  if (status === 'prepare') return 'prepare';
  if (status === 'due_soon') return 'due_soon';
  if (status === 'upcoming') return 'upcoming';
  return null;
}

export function routineTitleForType(type) {
  if (type === 'critically_overdue') return `${ROUTINE_SERVICE_LABEL} critically overdue`;
  if (type === 'overdue') return `${ROUTINE_SERVICE_LABEL} overdue`;
  if (type === 'due_now') return `${ROUTINE_SERVICE_LABEL} due now`;
  if (type === 'prepare') return `${ROUTINE_SERVICE_LABEL} — prepare for service`;
  if (type === 'due_soon' || type === 'due') return `${ROUTINE_SERVICE_LABEL} due soon`;
  return `${ROUTINE_SERVICE_LABEL} upcoming`;
}

/**
 * @param {object} params
 * @param {object} params.record service record DTO after completion
 * @param {{ id?: string, name?: string|null, plateNumber?: string|null }|null} [params.vehicle]
 * @param {string} [params.companyId]
 * @param {number|null} [params.actorUserId]
 */
export async function notifyRoutineServiceCompleted({
  record,
  vehicle = null,
  companyId = null,
  actorUserId = null,
}) {
  if (!record?.id || record.maintenanceId == null) return;

  const label = vehicleLabel(vehicle);
  const odometer = formatOdometer(record.odometerKm);
  const message = odometer
    ? `${label} — ${ROUTINE_SERVICE_LABEL} completed at ${odometer}`
    : `${label} — ${ROUTINE_SERVICE_LABEL} completed`;

  const io = getNotificationIo();
  const policy = maintenanceCompletedPolicy({ recordId: record.id, completedAt: record.completedAt });

  await publishNotification({
    type: policy.type,
    entityType: policy.entityType,
    entityId: String(record.maintenanceId),
    severity: policy.severity,
    urgency: policy.urgency,
    title: `${ROUTINE_SERVICE_LABEL} completed`,
    message,
    source: 'fuel-api',
    companyId,
    audience: policy.audience,
    metadata: {
      serviceRecordId: record.id,
      fleetVehicleId: record.fleetVehicleId,
      maintenanceId: record.maintenanceId,
      vehicleName: vehicle?.name ?? null,
      plateNumber: vehicle?.plateNumber ?? null,
      odometerKm: record.odometerKm ?? null,
      vendor: record.vendor ?? null,
      completedAt: policy.resolvedCompletedAt,
      actorUserId,
    },
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
  }, { io });
}

/**
 * Emits stateful routine-service notifications for upcoming/due/overdue.
 * Deduped daily per vehicle + status bucket.
 */
export async function notifyRoutineServiceState({
  fleetVehicleId,
  nextService,
  vehicle = null,
  companyId = null,
}) {
  const mappedType = mapRoutineStatusToType(nextService?.status, Number(nextService?.remainingKm));
  if (!mappedType || !fleetVehicleId || nextService?.maintenanceId == null) return;

  const label = vehicleLabel(vehicle);
  const dueLabel = nextService?.dueLabel || nextService?.statusLabel || null;
  const message = dueLabel
    ? `${label} — ${ROUTINE_SERVICE_LABEL}: ${dueLabel}`
    : `${label} — ${ROUTINE_SERVICE_LABEL} needs attention`;
  const io = getNotificationIo();
  const policy = maintenanceRoutineStatePolicy({ fleetVehicleId, mappedType });

  await publishNotification({
    type: policy.type,
    entityType: policy.entityType,
    entityId: String(nextService.maintenanceId),
    severity: policy.severity,
    urgency: policy.urgency,
    title: routineTitleForType(mappedType),
    message,
    source: 'fuel-api',
    companyId,
    audience: policy.audience,
    metadata: {
      fleetVehicleId,
      maintenanceId: nextService.maintenanceId,
      status: nextService.status,
      statusLabel: nextService.statusLabel ?? null,
      dueLabel: nextService.dueLabel ?? null,
      remainingKm: nextService.remainingKm ?? null,
      plateNumber: vehicle?.plateNumber ?? null,
      vehicleName: vehicle?.name ?? null,
      observedAt: new Date().toISOString(),
    },
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
  }, { io });
}

/**
 * Non-routine maintenance risk: OTHER (non-routine-tagged) Traccar maintenance
 * schedules on this vehicle, aggregated as a count — distinct from the
 * routine-service due-date ladder above. Mirrors intelligenceBuilder.js's own
 * overdueCount/dueSoonCount branching (overdue takes priority over due-soon),
 * but scheduler-driven per vehicle rather than page-view-triggered.
 */
export async function notifyMaintenanceRisk({
  fleetVehicleId,
  overdueCount = 0,
  dueSoonCount = 0,
  vehicle = null,
  companyId = null,
}) {
  if (!fleetVehicleId) return;
  const tier = overdueCount > 0 ? 'overdue' : (dueSoonCount > 0 ? 'due_soon' : null);
  if (!tier) return;

  const label = vehicleLabel(vehicle);
  const count = tier === 'overdue' ? overdueCount : dueSoonCount;
  const message = tier === 'overdue'
    ? `${label} — ${count} maintenance service(s) overdue`
    : `${label} — ${count} maintenance service(s) due soon`;
  const io = getNotificationIo();
  const policy = maintenanceRiskPolicy({ fleetVehicleId, tier });

  await publishNotification({
    type: policy.type,
    entityType: policy.entityType,
    entityId: String(fleetVehicleId),
    severity: policy.severity,
    urgency: policy.urgency,
    title: tier === 'overdue' ? 'Maintenance overdue' : 'Maintenance due soon',
    message,
    source: 'fuel-api',
    companyId,
    audience: policy.audience,
    metadata: {
      fleetVehicleId,
      tier,
      overdueCount,
      dueSoonCount,
      plateNumber: vehicle?.plateNumber ?? null,
      vehicleName: vehicle?.name ?? null,
      observedAt: new Date().toISOString(),
    },
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
  }, { io });
}
