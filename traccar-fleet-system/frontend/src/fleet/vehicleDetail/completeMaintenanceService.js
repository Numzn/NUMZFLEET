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
 * Records a completed service. The linked Traccar maintenance schedule is
 * rebased server-side, as part of the same completion request (see
 * serviceRecordService.js) — not a second client-initiated call, so a lost
 * connection between "record completed" and "schedule rebased" can no
 * longer leave the system silently inconsistent.
 */
export async function completeMaintenanceService(user, fleetVehicleId, maintenanceItem, form = {}) {
  if (!maintenanceItem?.id) {
    throw new Error('Maintenance schedule is required');
  }
  if (maintenanceItem.unknown) {
    throw new Error('Cannot complete service without current telemetry data');
  }

  const payload = {
    title: maintenanceItem.name,
    maintenanceId: maintenanceItem.id,
    vendor: form.technician?.trim() || form.vendor?.trim() || undefined,
    notes: form.notes?.trim() || undefined,
  };

  if (form.cost !== '' && form.cost != null) {
    const total = Number(form.cost);
    payload.cost = total;
    payload.actualCost = total;
    if (form.labourCost != null && form.labourCost !== '') {
      payload.labourCost = Number(form.labourCost);
    } else {
      payload.labourCost = Math.round(total * 0.3 * 100) / 100;
    }
    if (form.partsCost != null && form.partsCost !== '') {
      payload.partsCost = Number(form.partsCost);
    } else {
      payload.partsCost = Math.round(total * 0.7 * 100) / 100;
    }
  }

  if (isDistanceMaintenanceType(maintenanceItem.type) && form.odometerKm !== '' && form.odometerKm != null) {
    payload.odometerKm = Number(form.odometerKm);
  }

  const record = await createVehicleServiceRecord(user, fleetVehicleId, payload);
  const completionPatch = { status: 'completed' };
  if (form.completedAt) {
    completionPatch.completedAt = form.completedAt;
  }
  const completed = await updateVehicleServiceRecord(user, fleetVehicleId, record.id, completionPatch);

  if (completed.scheduleResetStatus === 'failed') {
    const wrapped = new Error(
      completed.scheduleResetError
        ? `Service was recorded but the maintenance schedule could not be reset: ${completed.scheduleResetError}`
        : 'Service was recorded but the maintenance schedule could not be reset.',
    );
    wrapped.serviceRecordId = completed.id;
    wrapped.partialSuccess = true;
    throw wrapped;
  }

  return completed;
}
