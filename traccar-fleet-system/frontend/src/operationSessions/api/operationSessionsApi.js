import fetchOrThrow from '../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders, fuelApiMultipartHeaders } from '../../config/fuelApiAuth.js';

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

export async function patchOperationSession(user, sessionId, payload) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function fetchOperationInvoice(user, sessionId) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/invoice`, {
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

export async function upsertOperationInvoice(user, sessionId, payload) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/invoice`, {
    method: 'PUT',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function fetchOperationInvoices(user, sessionId) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/invoices`, {
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

export async function createOperationInvoice(user, sessionId, payload) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/invoices`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function updateOperationInvoice(user, sessionId, invoiceId, payload) {
  const response = await fetchOrThrow(
    `/api/operation-sessions/${encodeURIComponent(sessionId)}/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: 'PATCH',
      headers: fuelApiAuthHeaders(user),
      body: JSON.stringify(payload),
    },
  );
  return response.json();
}

function appendInvoiceFields(formData, fields = {}) {
  if (fields.invoiceNumber) formData.append('invoiceNumber', String(fields.invoiceNumber));
  if (fields.invoiceDate) formData.append('invoiceDate', String(fields.invoiceDate));
  if (fields.totalLitres != null && fields.totalLitres !== '') {
    formData.append('totalLitres', String(fields.totalLitres));
  }
  if (fields.totalCost != null && fields.totalCost !== '') {
    formData.append('totalCost', String(fields.totalCost));
  }
  if (fields.dieselLitres != null && fields.dieselLitres !== '') {
    formData.append('dieselLitres', String(fields.dieselLitres));
  }
  if (fields.petrolLitres != null && fields.petrolLitres !== '') {
    formData.append('petrolLitres', String(fields.petrolLitres));
  }
  if (Array.isArray(fields.refuelIds)) {
    formData.append('refuelIds', JSON.stringify(fields.refuelIds));
  }
}

export async function uploadOperationInvoice(user, sessionId, file, fields = {}) {
  const formData = new FormData();
  formData.append('file', file);
  appendInvoiceFields(formData, fields);
  const response = await fetchOrThrow(
    `/api/operation-sessions/${encodeURIComponent(sessionId)}/invoices/upload`,
    {
      method: 'POST',
      headers: fuelApiMultipartHeaders(user),
      body: formData,
    },
  );
  return response.json();
}

export async function replaceOperationInvoiceFile(user, sessionId, invoiceId, file, fields = {}) {
  const formData = new FormData();
  formData.append('file', file);
  appendInvoiceFields(formData, fields);
  const response = await fetchOrThrow(
    `/api/operation-sessions/${encodeURIComponent(sessionId)}/invoices/${encodeURIComponent(invoiceId)}/upload`,
    {
      method: 'PATCH',
      headers: fuelApiMultipartHeaders(user),
      body: formData,
    },
  );
  return response.json();
}

export async function closeOperationSession(user, sessionId) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/close`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

export async function markRefuelArrived(user, sessionId, payload) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/arrive`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function skipOperationVehicle(user, sessionId, payload) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/skip`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function unskipOperationVehicle(user, sessionId, payload) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/unskip`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function planOperationVehicles(user, payload) {
  const response = await fetchOrThrow('/api/operation-sessions/plan', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return response.json();
}

/** @deprecated use planOperationVehicles */
export async function createOperationSession(user, payload) {
  const response = await fetchOrThrow('/api/operation-sessions', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
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

export async function recordOperationRefuel(user, sessionId, payload) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/refuel`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function fetchOperationForecast(user, sessionId) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/forecast`, {
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

export async function regenerateOperationForecast(user, sessionId) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/forecast/regenerate`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

export async function approveOperation(user, sessionId) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/approve`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

export async function createOperationAdjustment(user, sessionId, payload) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/adjustments`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function unlockOperation(user, sessionId, payload) {
  const response = await fetchOrThrow(`/api/operation-sessions/${encodeURIComponent(sessionId)}/unlock`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function fetchVehicleFuelStatistics(user, vehicleId) {
  const response = await fetchOrThrow(`/api/operation-sessions/vehicles/${encodeURIComponent(vehicleId)}/statistics`, {
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

export async function fetchDailyOperationReports(user, query = {}) {
  const params = new URLSearchParams();
  if (query.calendarDate) params.set('calendarDate', query.calendarDate);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const qs = params.toString();
  const response = await fetchOrThrow(`/api/operation-sessions/reports/daily${qs ? `?${qs}` : ''}`, {
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

export async function fetchVehicleOperationReports(user, query = {}) {
  const params = new URLSearchParams();
  if (query.vehicleId != null) params.set('vehicleId', String(query.vehicleId));
  if (query.limit != null) params.set('limit', String(query.limit));
  const qs = params.toString();
  const response = await fetchOrThrow(`/api/operation-sessions/reports/vehicles${qs ? `?${qs}` : ''}`, {
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}

export async function fetchManagementOperationReports(user, query = {}) {
  const params = new URLSearchParams();
  if (query.month) params.set('month', query.month);
  const qs = params.toString();
  const response = await fetchOrThrow(`/api/operation-sessions/reports/management${qs ? `?${qs}` : ''}`, {
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
