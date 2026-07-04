/**
 * Fleet vehicles (fuel-api / Postgres + Traccar merge). Same auth as fuel-requests / vehicle-specs.
 */
import fetchOrThrow from '../common/util/fetchOrThrow';
import { fuelApiAuthHeaders, fuelApiMultipartHeaders } from '../config/fuelApiAuth.js';

export async function fetchVehicles(user) {
  const res = await fetchOrThrow('/api/vehicles', {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function createVehicle(user, { name, plateNumber }) {
  const res = await fetchOrThrow('/api/vehicles', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({
      name,
      plateNumber: plateNumber || null,
    }),
  });
  return res.json();
}

export async function assignVehicleDevice(user, vehicleId, deviceId) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}/assign-device`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ deviceId: Number(deviceId) }),
  });
  return res.json();
}

export async function updateVehicle(user, vehicleId, { name, plateNumber }) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: 'PUT',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ name, plateNumber: plateNumber || null }),
  });
  return res.json();
}

export async function fetchVehicleOdometerState(user, fleetVehicleId) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(fleetVehicleId)}/odometer`, {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function recordOdometerObservation(user, fleetVehicleId, { odometerKm, source }) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(fleetVehicleId)}/odometer/observation`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ odometerKm: Number(odometerKm), source: source || 'manual' }),
  });
  return res.json();
}

/** Extract `{ error }` from fuel-api JSON bodies thrown by fetchOrThrow. */
export function fuelApiErrorMessage(thrown, fallback = 'Request failed') {
  const raw = thrown?.message || '';
  try {
    const body = JSON.parse(raw);
    if (body?.error) return String(body.error);
  } catch {
    /* plain text or HTML */
  }
  return raw.trim() || fallback;
}

/**
 * Categorize a fetchOrThrow rejection for list-load UI: distinguishes auth,
 * rate-limit, server, and network failures from a true empty result, so a
 * failed request never reads as "no vehicles yet". `thrown.status` is set by
 * fetchOrThrow for HTTP error responses; its absence means fetch() itself
 * rejected (offline, DNS, connection refused, CORS), i.e. a network failure.
 */
export function vehiclesLoadErrorMessage(thrown) {
  const status = thrown?.status;
  if (status === 401) {
    return 'Your session has expired or you are not signed in. Please sign in again.';
  }
  if (status === 429) {
    return 'Too many requests right now. Please wait a moment and try again.';
  }
  if (typeof status === 'number' && status >= 500) {
    return 'The server had a problem loading vehicles. Please try again shortly.';
  }
  if (status == null) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return fuelApiErrorMessage(thrown, 'Failed to load vehicles');
}

export async function deleteVehicle(user, vehicleId) {
  await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: 'DELETE',
    headers: fuelApiAuthHeaders(user),
  });
}

export async function fetchVehicle(user, vehicleId) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}`, {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function fetchVehicleFuelStatistics(user, fleetVehicleId) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/fuel-statistics`,
    { headers: fuelApiAuthHeaders(user) },
  );
  return res.json();
}

export async function updateVehicleConfig(user, vehicleId, body) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}/config`, {
    method: 'PUT',
    headers: {
      ...fuelApiAuthHeaders(user),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function saveRoutineService(user, vehicleId, { intervalKm, startingOdometerKm }) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}/routine-service`, {
    method: 'PUT',
    headers: {
      ...fuelApiAuthHeaders(user),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ intervalKm, startingOdometerKm }),
  });
  return res.json();
}

export async function fetchTraccarMaintenances(user) {
  const res = await fetchOrThrow('/api/fleet/traccar-maintenances', {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function resetTraccarMaintenanceSchedule(user, fleetVehicleId, maintenanceId, body) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/traccar-maintenance/${encodeURIComponent(maintenanceId)}/reset`,
    {
      method: 'PUT',
      headers: {
        ...fuelApiAuthHeaders(user),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  return res.json();
}

export async function fetchVehicleServiceRecords(user, fleetVehicleId) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/service-records`,
    { headers: fuelApiAuthHeaders(user) },
  );
  return res.json();
}

export async function createVehicleServiceRecord(user, fleetVehicleId, payload) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/service-records`,
    {
      method: 'POST',
      headers: fuelApiAuthHeaders(user),
      body: JSON.stringify(payload),
    },
  );
  return res.json();
}

export async function updateVehicleServiceRecord(user, fleetVehicleId, recordId, payload) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/service-records/${encodeURIComponent(recordId)}`,
    {
      method: 'PATCH',
      headers: fuelApiAuthHeaders(user),
      body: JSON.stringify(payload),
    },
  );
  return res.json();
}

/** Retry a failed Traccar schedule rebase for a completed, maintenance-linked service record. */
export async function retryServiceRecordScheduleReset(user, fleetVehicleId, recordId) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/service-records/${encodeURIComponent(recordId)}/retry-schedule-reset`,
    {
      method: 'POST',
      headers: fuelApiAuthHeaders(user),
    },
  );
  return res.json();
}

export async function patchVehicleFields(user, vehicleId, fields) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: 'PATCH',
    headers: {
      ...fuelApiAuthHeaders(user),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fields),
  });
  return res.json();
}

export async function uploadVehiclePhoto(user, vehicleId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}/photo`, {
    method: 'POST',
    headers: fuelApiMultipartHeaders(user),
    body: form,
  });
  return res.json();
}

/** @deprecated Use fetchVehicleEngine — overview slices live on engine.engine */
export async function fetchOverviewMetrics(user, fleetVehicleId) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/overview-metrics`,
    { headers: fuelApiAuthHeaders(user) },
  );
  return res.json();
}

export async function fetchVehicleEngine(user, fleetVehicleId) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/engine`,
    { headers: fuelApiAuthHeaders(user) },
  );
  return res.json();
}

export async function fetchFleetFuelAverage(user) {
  const res = await fetchOrThrow('/api/vehicles/fuel-efficiency/fleet-average', {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function fetchVehicleDocuments(user, fleetVehicleId) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/documents`,
    { headers: fuelApiAuthHeaders(user) },
  );
  return res.json();
}

export async function uploadVehicleDocument(user, fleetVehicleId, file, { title, category } = {}) {
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  if (category) form.append('category', category);
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/documents`,
    {
      method: 'POST',
      headers: fuelApiMultipartHeaders(user),
      body: form,
    },
  );
  return res.json();
}

export async function deleteVehicleDocument(user, fleetVehicleId, docId) {
  await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/documents/${encodeURIComponent(docId)}`,
    {
      method: 'DELETE',
      headers: fuelApiAuthHeaders(user),
    },
  );
}

export async function runVehicleDocumentOcr(user, fleetVehicleId, docId) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/documents/${encodeURIComponent(docId)}/ocr`,
    {
      method: 'POST',
      headers: fuelApiAuthHeaders(user),
    },
  );
  return res.json();
}

export async function fetchVehicleCompliance(user, fleetVehicleId) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/compliance`,
    { headers: fuelApiAuthHeaders(user) },
  );
  return res.json();
}

export async function createVehicleCompliance(user, fleetVehicleId, payload) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/compliance`,
    {
      method: 'POST',
      headers: fuelApiAuthHeaders(user),
      body: JSON.stringify(payload),
    },
  );
  return res.json();
}

export async function updateVehicleCompliance(user, fleetVehicleId, complianceId, payload) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/compliance/${encodeURIComponent(complianceId)}`,
    {
      method: 'PATCH',
      headers: fuelApiAuthHeaders(user),
      body: JSON.stringify(payload),
    },
  );
  return res.json();
}

export async function deleteVehicleCompliance(user, fleetVehicleId, complianceId) {
  await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/compliance/${encodeURIComponent(complianceId)}`,
    {
      method: 'DELETE',
      headers: fuelApiAuthHeaders(user),
    },
  );
}
