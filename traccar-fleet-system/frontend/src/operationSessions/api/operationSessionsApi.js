import fetchOrThrow from '../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';

export async function fetchOperationSessions(user) {
  const response = await fetchOrThrow('/api/operation-sessions', {
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

export async function fetchOperationSessionDetails(user, sessionId) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}`, {
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

export async function createOperationSession(user, payload) {
  const response = await fetchOrThrow('/api/operation-sessions', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function createSessionRefuelRecords(user, sessionId, records) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/refuels`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ records }),
  });
  return response.json();
}

export async function submitSessionRefuelUpdates(user, sessionId, updates) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/refuels`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ updates }),
  });
  return response.json();
}

export async function closeOperationSession(user, sessionId) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/close`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

/** Fuel-api intelligence: vehicles ranked by estimated litres to fill (specs + telemetry). */
export async function fetchVehicleRefuelSuggestions(user, query = {}) {
  const params = new URLSearchParams();
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.excludeSessionId != null) params.set('excludeSessionId', String(query.excludeSessionId));
  const qs = params.toString();
  const path = `/api/operation-sessions/suggestions/vehicles${qs ? `?${qs}` : ''}`;
  const response = await fetchOrThrow(path, {
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}
