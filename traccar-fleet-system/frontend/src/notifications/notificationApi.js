/**
 * Client API for persisted notifications (fuel-api).
 */

async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * @param {{ before?: string, limit?: number, category?: string, severity?: string, read?: string }} params
 */
export async function fetchNotifications(params = {}) {
  const q = new URLSearchParams();
  if (params.before) q.set('before', params.before);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.category) q.set('category', params.category);
  if (params.severity) q.set('severity', params.severity);
  if (params.read) q.set('read', params.read);
  const qs = q.toString();
  const res = await fetch(`/api/notifications${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`notifications ${res.status}`);
  return parseJsonResponse(res);
}

export async function markNotificationRead(id) {
  const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`mark read ${res.status}`);
  return parseJsonResponse(res);
}

export async function markAllNotificationsRead() {
  const res = await fetch('/api/notifications/read-all', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`read all ${res.status}`);
  return parseJsonResponse(res);
}

export async function archiveNotificationApi(id) {
  const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 204) throw new Error(`archive ${res.status}`);
  return true;
}

export async function patchNotificationLifecycle(id, body) {
  const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/lifecycle`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`lifecycle ${res.status}`);
  return parseJsonResponse(res);
}

/**
 * Map API row to unified Notification entity for Redux.
 * @param {object} row
 */
export function mapServerNotificationToEntity(row) {
  if (!row?.id) return null;
  return {
    id: row.id,
    serverId: row.id,
    type: row.type || 'system',
    category: row.category || 'system',
    severity: row.severity || 'info',
    title: row.title || '',
    message: row.message || '',
    source: row.source || 'fuel-api',
    timestamp: row.createdAt || row.timestamp
      ? new Date(row.createdAt || row.timestamp).toISOString()
      : new Date().toISOString(),
    read: !!row.read,
    archived: !!row.archived,
    actionable: row.actionable !== false,
    metadata: {
      ...(typeof row.metadata === 'object' && row.metadata ? row.metadata : {}),
      delivered: { toast: true, push: true, sound: true },
    },
    viewedAt: row.viewedAt || null,
    acknowledgedAt: row.acknowledgedAt || null,
    resolvedAt: row.resolvedAt || null,
  };
}
