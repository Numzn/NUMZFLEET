/** @typedef {'info'|'success'|'warning'|'critical'} NotificationSeverity */

const ALLOWED_SEVERITIES = new Set(['info', 'success', 'warning', 'critical']);

/**
 * @param {string} [severity]
 * @returns {NotificationSeverity}
 */
export function normalizeSeverity(severity) {
  const s = String(severity || 'info').toLowerCase();
  if (ALLOWED_SEVERITIES.has(s)) return /** @type {NotificationSeverity} */ (s);
  if (s === 'error') return 'critical';
  return 'info';
}

/**
 * @param {Record<string, unknown>} [metadata]
 */
function resolveEntityIdFromMetadata(metadata) {
  if (!metadata) return null;
  if (metadata.requestId != null) return String(metadata.requestId);
  if (metadata.traccarEventId != null) return String(metadata.traccarEventId);
  if (metadata.intentId != null) return String(metadata.intentId);
  if (metadata.vehicleId != null) return String(metadata.vehicleId);
  if (metadata.deviceId != null) return String(metadata.deviceId);
  return null;
}

/**
 * @param {import('./contracts/notificationContract.js').PublishNotificationSpec} input
 * @returns {import('./contracts/notificationContract.js').NormalizedNotification}
 */
export function createNotification(input) {
  const entityType = input.entityType || input.category;
  if (!entityType) {
    throw new Error('[notifications] entityType or category is required');
  }

  const entityId = input.entityId != null
    ? String(input.entityId)
    : resolveEntityIdFromMetadata(input.metadata);
  if (!entityId) {
    throw new Error('[notifications] entityId is required');
  }

  if (!input.clientDedupKey) {
    throw new Error('[notifications] clientDedupKey is required');
  }

  const source = input.source || 'fuel-api';
  const metadata = {
    ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
    entityType,
    entityId,
  };

  return {
    type: input.type,
    category: entityType,
    entityType,
    entityId,
    severity: normalizeSeverity(input.severity),
    title: String(input.title || ''),
    message: String(input.message || ''),
    source,
    audience: input.audience,
    metadata,
    clientDedupKey: input.clientDedupKey,
    channels: input.channels,
  };
}

/**
 * Canonical API / websocket payload (persist-before-emit).
 * @param {object} row from repository toApi()
 */
export function toCanonicalPayload(row) {
  if (!row?.id) {
    throw new Error('[notifications] cannot build canonical payload without id');
  }

  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const entityType = row.entityType || row.category || meta.entityType || 'system';
  const entityId = row.entityId != null
    ? String(row.entityId)
    : (meta.entityId != null ? String(meta.entityId) : String(row.id));

  const readAt = row.readAt != null
    ? row.readAt
    : (row.read ? (row.viewedAt || row.updatedAt || null) : null);

  return {
    id: row.id,
    type: row.type,
    severity: normalizeSeverity(row.severity),
    title: row.title || '',
    message: row.message || '',
    userId: row.userId,
    entityType,
    entityId,
    source: row.source || 'fuel-api',
    createdAt: row.createdAt,
    readAt,
    archived: !!row.archived,
    metadata: meta,
    // Transition fields — remove in PR2
    category: entityType,
    read: !!row.read,
    viewedAt: row.viewedAt ?? null,
    acknowledgedAt: row.acknowledgedAt ?? null,
    resolvedAt: row.resolvedAt ?? null,
  };
}
