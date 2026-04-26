export function operationSessionsAuthHeaders(user) {
  return {
    'Content-Type': 'application/json',
    ...(user?.id ? { 'X-User-Id': String(user.id) } : {}),
  };
}

const ensureResponse = async (response) => {
  if (!response.ok) {
    throw new Error((await response.text()) || response.statusText);
  }
  return response.json();
};

export async function fetchOperationSessions(user) {
  const response = await fetch('/api/operation-sessions', {
    credentials: 'include',
    headers: operationSessionsAuthHeaders(user),
  });
  return ensureResponse(response);
}

export async function fetchOperationSessionDetails(user, sessionId) {
  const response = await fetch(`/api/operation-sessions/${encodeURIComponent(sessionId)}`, {
    credentials: 'include',
    headers: operationSessionsAuthHeaders(user),
  });
  return ensureResponse(response);
}

export async function createOperationSession(user, payload) {
  const response = await fetch('/api/operation-sessions', {
    method: 'POST',
    credentials: 'include',
    headers: operationSessionsAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return ensureResponse(response);
}

export async function createSessionRefuelRecords(user, sessionId, records) {
  const response = await fetch(`/api/operation-sessions/${encodeURIComponent(sessionId)}/refuels`, {
    method: 'POST',
    credentials: 'include',
    headers: operationSessionsAuthHeaders(user),
    body: JSON.stringify({ records }),
  });
  return ensureResponse(response);
}

export async function closeOperationSession(user, sessionId) {
  const response = await fetch(`/api/operation-sessions/${encodeURIComponent(sessionId)}/close`, {
    method: 'POST',
    credentials: 'include',
    headers: operationSessionsAuthHeaders(user),
  });
  return ensureResponse(response);
}
