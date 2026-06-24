import { traccarPath } from '../../config/traccarApi.js';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import {
  createVehicleServiceRecord,
  updateVehicleServiceRecord,
} from '../vehiclesApi.js';

export function isTimeMaintenanceType(type) {
  return typeof type === 'string' && type.endsWith('Time');
}

export function isHoursMaintenanceType(type) {
  return type === 'hours' || type === 'drivingTime';
}

export function isDistanceMaintenanceType(type) {
  return !isTimeMaintenanceType(type) && !isHoursMaintenanceType(type);
}

/**
 * Maps a computed maintenance item to the Traccar `start` value used to reset
 * the schedule after service. Does not compute intervals — only reads current
 * accumulator or wall clock per Traccar's maintenance model.
 */
export function resolveResetStart(maintenanceItem) {
  if (!maintenanceItem || maintenanceItem.unknown) {
    throw new Error('Cannot reset maintenance without current telemetry data');
  }

  const { type } = maintenanceItem;

  if (isTimeMaintenanceType(type)) {
    return Date.now();
  }

  const current = Number(maintenanceItem.current);
  if (!Number.isFinite(current)) {
    throw new Error('Cannot reset maintenance without current telemetry data');
  }

  return current;
}

function toTraccarMaintenanceBody(maintenanceItem, newStart) {
  return {
    id: maintenanceItem.id,
    name: maintenanceItem.name,
    type: maintenanceItem.type,
    start: newStart,
    period: maintenanceItem.period,
    attributes: maintenanceItem.attributes ?? {},
  };
}

export async function resetTraccarMaintenance(maintenanceItem, newStart) {
  const start = newStart ?? resolveResetStart(maintenanceItem);
  await fetchOrThrow(traccarPath(`/api/maintenance/${maintenanceItem.id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toTraccarMaintenanceBody(maintenanceItem, start)),
  });
}

/**
 * Records a completed service and resets the linked Traccar maintenance schedule.
 * Traccar remains the schedule source of truth; fuel-api stores the audit trail.
 */
export async function completeMaintenanceService(user, fleetVehicleId, maintenanceItem, form = {}) {
  if (!maintenanceItem?.id) {
    throw new Error('Maintenance schedule is required');
  }
  if (maintenanceItem.unknown) {
    throw new Error('Cannot complete service without current telemetry data');
  }

  const resetStart = resolveResetStart(maintenanceItem);

  const payload = {
    title: maintenanceItem.name,
    maintenanceId: maintenanceItem.id,
    vendor: form.vendor?.trim() || undefined,
    notes: form.notes?.trim() || undefined,
  };

  if (form.cost !== '' && form.cost != null) {
    payload.cost = Number(form.cost);
  }

  if (isDistanceMaintenanceType(maintenanceItem.type) && form.odometerKm !== '' && form.odometerKm != null) {
    payload.odometerKm = Number(form.odometerKm);
  }

  const record = await createVehicleServiceRecord(user, fleetVehicleId, payload);
  await updateVehicleServiceRecord(user, fleetVehicleId, record.id, { status: 'completed' });

  try {
    await resetTraccarMaintenance(maintenanceItem, resetStart);
  } catch (error) {
    const wrapped = new Error(
      'Service was recorded but the maintenance schedule could not be reset. '
      + 'Update the schedule manually under Settings → Maintenance.',
    );
    wrapped.cause = error;
    wrapped.serviceRecordId = record.id;
    wrapped.partialSuccess = true;
    throw wrapped;
  }

  return record;
}
