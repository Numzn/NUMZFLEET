import { publishNotification } from './orchestrator/publishNotification.js';
import { CHANNELS } from './contracts/notificationContract.js';
import { getNotificationIo } from './notificationContext.js';
import { ROUTINE_SERVICE_LABEL } from '../maintenance/routineServiceStatus.js';
import { localDateString } from '../utils/businessDay.js';

function vehicleLabel(vehicle) {
  if (!vehicle) return 'Vehicle';
  return vehicle.plateNumber || vehicle.name || 'Vehicle';
}

function formatOdometer(km) {
  if (km == null || !Number.isFinite(Number(km))) return null;
  return `${Math.round(Number(km)).toLocaleString()} km`;
}

function mapRoutineStatusToType(status) {
  if (status === 'overdue') return 'overdue';
  if (status === 'upcoming') return 'upcoming';
  if (['due_now', 'prepare', 'due_soon'].includes(status)) return 'due';
  return null;
}

function routineTitleForType(type) {
  if (type === 'overdue') return `${ROUTINE_SERVICE_LABEL} overdue`;
  if (type === 'due') return `${ROUTINE_SERVICE_LABEL} due`;
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
  const completedAt = record.completedAt || new Date().toISOString();
  const message = odometer
    ? `${label} — ${ROUTINE_SERVICE_LABEL} completed at ${odometer}`
    : `${label} — ${ROUTINE_SERVICE_LABEL} completed`;

  const io = getNotificationIo();

  await publishNotification({
    type: 'maintenance.routine.completed',
    entityType: 'maintenance',
    entityId: String(record.maintenanceId),
    severity: 'success',
    title: `${ROUTINE_SERVICE_LABEL} completed`,
    message,
    source: 'fuel-api',
    companyId,
    audience: { managers: true },
    metadata: {
      serviceRecordId: record.id,
      fleetVehicleId: record.fleetVehicleId,
      maintenanceId: record.maintenanceId,
      vehicleName: vehicle?.name ?? null,
      plateNumber: vehicle?.plateNumber ?? null,
      odometerKm: record.odometerKm ?? null,
      vendor: record.vendor ?? null,
      completedAt,
      actorUserId,
    },
    clientDedupKey: `routine-service:${record.id}:completed:${completedAt}`,
    channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
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
  const mappedType = mapRoutineStatusToType(nextService?.status);
  if (!mappedType || !fleetVehicleId || nextService?.maintenanceId == null) return;

  const label = vehicleLabel(vehicle);
  const dueLabel = nextService?.dueLabel || nextService?.statusLabel || null;
  const message = dueLabel
    ? `${label} — ${ROUTINE_SERVICE_LABEL}: ${dueLabel}`
    : `${label} — ${ROUTINE_SERVICE_LABEL} needs attention`;
  const severity = mappedType === 'overdue' ? 'warning' : 'info';
  // Africa/Lusaka business day, not UTC calendar day — same fix already
  // applied to complianceNotificationService.js, reusing the same helper
  // rather than a second timezone implementation.
  const dayStamp = localDateString(new Date());
  const io = getNotificationIo();

  await publishNotification({
    type: `maintenance.routine.${mappedType}`,
    entityType: 'maintenance',
    entityId: String(nextService.maintenanceId),
    severity,
    title: routineTitleForType(mappedType),
    message,
    source: 'fuel-api',
    companyId,
    audience: { managers: true },
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
    clientDedupKey: `routine-service:${fleetVehicleId}:${mappedType}:${dayStamp}`,
    channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
  }, { io });
}
