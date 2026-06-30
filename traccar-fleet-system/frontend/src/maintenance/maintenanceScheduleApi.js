import fetchOrThrow from '../common/util/fetchOrThrow';
import { traccarPath } from '../config/traccarApi.js';
import { distanceToMeters } from '../common/util/converter';

const MS_PER_DAY = 86400000;

/** Traccar time-based schedules use a *Time type; position value is not read for due math. */
const TIME_MAINTENANCE_TYPE = 'deviceTime';
const DISTANCE_MAINTENANCE_TYPE = 'totalDistance';

/**
 * Create a Traccar maintenance schedule and link it to a device in one step.
 */
export async function createAndLinkMaintenanceSchedule(deviceId, {
  name,
  mode = 'km',
  interval,
  lastServiceAt,
}) {
  if (!deviceId) {
    throw new Error('Assign a tracker to this vehicle before adding a service schedule.');
  }
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('Service name is required.');
  }
  const intervalNum = Number(interval);
  if (!Number.isFinite(intervalNum) || intervalNum <= 0) {
    throw new Error('Repeat interval must be greater than zero.');
  }

  let type;
  let start;
  let period;

  if (mode === 'days') {
    type = TIME_MAINTENANCE_TYPE;
    const lastDate = lastServiceAt ? new Date(lastServiceAt) : new Date();
    if (Number.isNaN(lastDate.getTime())) {
      throw new Error('Last service date is invalid.');
    }
    start = lastDate.getTime();
    period = Math.round(intervalNum * MS_PER_DAY);
  } else {
    type = DISTANCE_MAINTENANCE_TYPE;
    const lastKm = Number(lastServiceAt);
    if (!Number.isFinite(lastKm) || lastKm < 0) {
      throw new Error('Last service odometer is required for distance schedules.');
    }
    start = distanceToMeters(lastKm, 'km');
    period = distanceToMeters(intervalNum, 'km');
  }

  const createRes = await fetchOrThrow(traccarPath('/api/maintenance'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: trimmedName,
      type,
      start,
      period,
      attributes: {},
    }),
  });
  const maintenance = await createRes.json();

  await fetchOrThrow(traccarPath('/api/permissions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: Number(deviceId),
      maintenanceId: maintenance.id,
    }),
  });

  return maintenance;
}

export const SCHEDULE_PRESETS = [
  { key: 'oil', label: 'Oil change', name: 'Oil change', mode: 'km', interval: 10000 },
  { key: 'tyres', label: 'Tyre rotation', name: 'Tyre rotation', mode: 'km', interval: 15000 },
  { key: 'brakes', label: 'Brake inspection', name: 'Brake inspection', mode: 'km', interval: 20000 },
  { key: 'annual', label: 'Annual service', name: 'Annual service', mode: 'days', interval: 365 },
];
