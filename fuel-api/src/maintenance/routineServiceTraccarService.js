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

  return { maintenanceId: Number(created.id) };
}

export { isTraccarCommandApiConfigured as isRoutineServiceTraccarConfigured };
