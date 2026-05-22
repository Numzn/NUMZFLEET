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
/**
 * @param {{ since?: string, limit?: number }} params
 */
export async function syncNotificationsSince(params = {}) {
  const q = new URLSearchParams();
  if (params.since) q.set('since', params.since);
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  const res = await fetch(`/api/notifications/sync${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`notifications sync ${res.status}`);
  return parseJsonResponse(res);
}

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

/** Channels already shown before this row entered Redux (sync / paginated fetch). */
const HYDRATE_DELIVERED = { toast: true, push: true, sound: true };

/**
 * Map API row to unified Notification entity for Redux.
 * @param {object} row
 * @param {{ markChannelsDelivered?: boolean }} [options]
 *   markChannelsDelivered — true for sync/hydrate (skip re-toast); false for live WS (default).
 */
export function mapServerNotificationToEntity(row, options = {}) {
  if (!row?.id) return null;

  const entityType = row.entityType || row.category || 'system';
  const entityId = row.entityId != null
    ? String(row.entityId)
    : (row.metadata?.entityId != null ? String(row.metadata.entityId) : String(row.id));
  const read = row.readAt != null ? true : !!row.read;
  const baseMeta = typeof row.metadata === 'object' && row.metadata ? row.metadata : {};
  const metadata = {
    ...baseMeta,
    entityType,
    entityId,
  };
  if (options.markChannelsDelivered) {
    metadata.delivered = { ...HYDRATE_DELIVERED };
  }

  return {
    id: row.id,
    serverId: row.id,
    type: row.type || 'system',
    category: entityType,
    entityType,
    entityId,
    severity: row.severity || 'info',
    title: row.title || '',
    message: row.message || '',
    source: row.source || 'fuel-api',
    timestamp: row.createdAt || row.timestamp
      ? new Date(row.createdAt || row.timestamp).toISOString()
      : new Date().toISOString(),
    read,
    readAt: row.readAt ?? null,
    archived: !!row.archived,
    actionable: row.actionable !== false,
    metadata,
    viewedAt: row.viewedAt || null,
    acknowledgedAt: row.acknowledgedAt || null,
    resolvedAt: row.resolvedAt || null,
  };
}
