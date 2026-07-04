import traccar from '../config/traccar.js';
import {
  isTraccarCommandApiConfigured,
  traccarFetch,
} from '../services/traccarCommandService.js';
import { ROUTINE_SERVICE_LABEL } from './routineServiceStatus.js';

const DISTANCE_TYPE = 'totalDistance';

function parseMaintenanceAttributes(row) {
  if (!row?.attributes) return {};
  if (typeof row.attributes === 'string') {
    try {
      return JSON.parse(row.attributes);
    } catch {
      return {};
    }
  }
  return row.attributes;
}

async function loadMaintenancesForDevice(deviceId) {
  const pool = traccar.getTraccarPool();
  const [rows] = await pool.execute(
    `SELECT m.id, m.name, m.type, m.start, m.period, m.attributes, dm.deviceid AS deviceId
     FROM tc_maintenances m
     INNER JOIN tc_device_maintenance dm ON dm.maintenanceid = m.id
     WHERE dm.deviceid = ?`,
    [Number(deviceId)],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    type: row.type,
    start: Number(row.start),
    period: Number(row.period),
    attributes: parseMaintenanceAttributes(row),
    deviceId: Number(row.deviceId),
  }));
}

export async function findRoutineServiceForDevice(deviceId) {
  const schedules = await loadMaintenancesForDevice(deviceId);
  return schedules.find((s) => s.attributes?.numzServicePackage === true) ?? null;
}

/** All numzServicePackage-tagged schedules for a device, oldest (lowest id) first. */
async function findAllRoutineServicesForDevice(deviceId) {
  const schedules = await loadMaintenancesForDevice(deviceId);
  return schedules
    .filter((s) => s.attributes?.numzServicePackage === true)
    .sort((a, b) => a.id - b.id);
}

function buildMaintenanceBody({ id, intervalKm, startingOdometerKm }) {
  const startM = Math.round(Number(startingOdometerKm) * 1000);
  const periodM = Math.round(Number(intervalKm) * 1000);
  return {
    ...(id != null ? { id: Number(id) } : {}),
    name: ROUTINE_SERVICE_LABEL,
    type: DISTANCE_TYPE,
    start: startM,
    period: periodM,
    attributes: { numzServicePackage: true },
  };
}

async function assertOk(response, fallbackMessage) {
  if (response.ok) return;
  const text = await response.text();
  const err = new Error(text || `${fallbackMessage} (${response.status})`);
  err.statusCode = response.status >= 500 ? 502 : response.status;
  if (response.status === 401 || response.status === 403) {
    err.authFailed = true;
  }
  throw err;
}

/**
 * Create or update the single tagged Routine Service schedule for a device.
 * Uses the same Traccar service account as immobilization (backend/.env).
 * @returns {Promise<{ maintenanceId: number }>}
 */
export async function upsertRoutineService({ deviceId, intervalKm, startingOdometerKm }) {
  if (!Number.isFinite(Number(deviceId))) {
    const err = new Error('deviceId is required');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isFinite(Number(intervalKm)) || Number(intervalKm) <= 0) {
    const err = new Error('intervalKm must be greater than zero');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isFinite(Number(startingOdometerKm)) || Number(startingOdometerKm) < 0) {
    const err = new Error('startingOdometerKm must be zero or greater');
    err.statusCode = 400;
    throw err;
  }
  if (!isTraccarCommandApiConfigured()) {
    const err = new Error(
      'Traccar service API not configured. Set TRACCAR_SERVER_URL, TRACCAR_API_USER, '
      + 'and TRACCAR_API_PASSWORD on fuel-api (same as immobilization).',
    );
    err.statusCode = 503;
    throw err;
  }

  const existing = await findRoutineServiceForDevice(deviceId);
  const body = buildMaintenanceBody({
    id: existing?.id,
    intervalKm,
    startingOdometerKm,
  });

  if (existing) {
    const response = await traccarFetch(`/api/maintenance/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    await assertOk(response, 'Traccar maintenance update failed');
    return { maintenanceId: existing.id };
  }

  const createRes = await traccarFetch('/api/maintenance', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  await assertOk(createRes, 'Traccar maintenance create failed');
  const created = await createRes.json();

  const permRes = await traccarFetch('/api/permissions', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: Number(deviceId),
      maintenanceId: Number(created.id),
    }),
  });
  await assertOk(permRes, 'Traccar maintenance link failed');

  return dedupeRoutineServices(deviceId, Number(created.id));
}

/**
 * Read-then-write race guard: two concurrent calls that both see "no
 * existing schedule" can both create one. Rather than a lock (this API call
 * is rare — an admin configuring a vehicle, not a hot path), self-heal
 * after the fact: if more than one numzServicePackage-tagged schedule now
 * exists for this device, the oldest (lowest id, most likely already
 * referenced by service_records.maintenanceId) wins and the rest are
 * removed.
 */
export async function dedupeRoutineServices(deviceId, justCreatedId) {
  const all = await findAllRoutineServicesForDevice(deviceId);
  if (all.length <= 1) {
    return { maintenanceId: justCreatedId };
  }

  const [canonical, ...duplicates] = all;
  await Promise.all(duplicates.map(async (dup) => {
    try {
      const response = await traccarFetch(`/api/maintenance/${dup.id}`, { method: 'DELETE' });
      await assertOk(response, 'Traccar maintenance duplicate cleanup failed');
    } catch {
      /* best-effort cleanup — a leftover duplicate is a smaller problem than throwing here */
    }
  }));

  return { maintenanceId: canonical.id };
}

function isTimeMaintenanceType(type) {
  return typeof type === 'string' && type.endsWith('Time');
}

/**
 * Rebase a Traccar maintenance schedule's `start` to the trusted completion
 * mileage (or now, for time-based schedules) — server-side equivalent of the
 * frontend's completeMaintenanceService.js reset step, so the whole
 * completion sequence runs as one backend request instead of two
 * client-initiated calls.
 * @param {{ deviceId: number, maintenanceId: number, completionOdometerKm: number|null }}
 * @returns {Promise<{ maintenanceId: number, newStart: number }>}
 */
export async function resetMaintenanceScheduleAfterCompletion({ deviceId, maintenanceId, completionOdometerKm }) {
  if (!isTraccarCommandApiConfigured()) {
    const err = new Error('Traccar service API not configured.');
    err.statusCode = 503;
    throw err;
  }

  const schedules = await loadMaintenancesForDevice(deviceId);
  const item = schedules.find((s) => s.id === Number(maintenanceId));
  if (!item) {
    const err = new Error(`Maintenance schedule ${maintenanceId} not found for device ${deviceId}`);
    err.statusCode = 404;
    throw err;
  }

  let newStart;
  if (isTimeMaintenanceType(item.type)) {
    newStart = Date.now();
  } else {
    if (completionOdometerKm == null || !Number.isFinite(Number(completionOdometerKm))) {
      const err = new Error('completionOdometerKm is required to reset a distance-based schedule');
      err.statusCode = 400;
      throw err;
    }
    newStart = Math.round(Number(completionOdometerKm) * 1000);
  }

  const response = await traccarFetch(`/api/maintenance/${item.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      id: item.id,
      name: item.name,
      type: item.type,
      start: newStart,
      period: item.period,
      attributes: item.attributes ?? {},
    }),
  });
  await assertOk(response, 'Traccar maintenance reset failed');

  return { maintenanceId: item.id, newStart };
}

export { isTraccarCommandApiConfigured as isRoutineServiceTraccarConfigured };
