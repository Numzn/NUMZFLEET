import {
  isTraccarCommandApiConfigured,
  traccarFetch,
} from './traccarCommandService.js';

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

function ensureConfigured() {
  if (!isTraccarCommandApiConfigured()) {
    const err = new Error(
      'Traccar service API not configured. Set TRACCAR_SERVER_URL, TRACCAR_API_USER, '
      + 'and TRACCAR_API_PASSWORD on fuel-api.',
    );
    err.statusCode = 503;
    throw err;
  }
}

/** List maintenance schedules via Traccar service account (admin). */
export async function listTraccarMaintenances() {
  ensureConfigured();
  const response = await traccarFetch('/api/maintenance');
  await assertOk(response, 'Traccar maintenance list failed');
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/** Reset a maintenance schedule start value after service completion. */
export async function resetTraccarMaintenanceSchedule(maintenanceId, body) {
  ensureConfigured();
  if (maintenanceId == null || !Number.isFinite(Number(maintenanceId))) {
    const err = new Error('maintenanceId is required');
    err.statusCode = 400;
    throw err;
  }
  const response = await traccarFetch(`/api/maintenance/${Number(maintenanceId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  await assertOk(response, 'Traccar maintenance reset failed');
  return response.json().catch(() => ({}));
}
