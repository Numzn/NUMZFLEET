import { Op } from 'sequelize';
import { UserNotification } from '../../models/index.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toApi(row) {
  if (!row) return null;
  const j = typeof row.toJSON === 'function' ? row.toJSON() : row;
  const iso = (d) => {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString();
    return d;
  };
  const metadata = j.metadata || {};
  const entityType = j.category || metadata.entityType || 'system';
  const entityId = metadata.entityId != null
    ? String(metadata.entityId)
    : (metadata.requestId != null ? String(metadata.requestId)
      : metadata.traccarEventId != null ? String(metadata.traccarEventId)
        : metadata.intentId != null ? String(metadata.intentId)
          : metadata.vehicleId != null ? String(metadata.vehicleId)
            : String(j.id));
  const read = !!j.read;
  const viewedAt = iso(j.viewedAt);
  const readAt = read ? (viewedAt || iso(j.updatedAt)) : null;

  return {
    id: j.id,
    userId: j.userId,
    type: j.type,
    category: entityType,
    entityType,
    entityId,
    severity: j.severity,
    title: j.title,
    message: j.message,
    source: j.source,
    metadata,
    read,
    readAt,
    archived: !!j.archived,
    viewedAt,
    acknowledgedAt: iso(j.acknowledgedAt),
    resolvedAt: iso(j.resolvedAt),
    createdAt: iso(j.createdAt),
    updatedAt: iso(j.updatedAt),
    clientDedupKey: j.clientDedupKey ?? j.client_dedup_key ?? null,
  };
}

export async function listNotificationsForUser(userId, query, companyId = null) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 40, 1), 100);
  const where = {
    userId,
    archived: false,
  };
  if (companyId) {
    where.tenantId = companyId;
  }
  if (query.category) where.category = query.category;
  if (query.severity) where.severity = query.severity;
  if (query.read === 'true') where.read = true;
  if (query.read === 'false') where.read = false;

  if (query.since) {
    const since = new Date(query.since);
    if (!Number.isNaN(since.getTime())) {
      where.createdAt = { ...(where.createdAt || {}), [Op.gt]: since };
    }
  }

  if (query.before) {
    const d = new Date(query.before);
    if (!Number.isNaN(d.getTime())) {
      where.createdAt = { ...(where.createdAt || {}), [Op.lt]: d };
    }
  }

  const rows = await UserNotification.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  const nextBefore = hasMore && last ? new Date(last.get('createdAt')).toISOString() : null;

  return {
    items: slice.map(toApi),
    nextBefore,
  };
}

export async function markReadForUser(userId, id) {
  const row = await UserNotification.findOne({ where: { id, userId, archived: false } });
  if (!row) return null;
  const now = new Date();
  await row.update({
    read: true,
    viewedAt: row.viewedAt || now,
  });
  return toApi(await row.reload());
}

export async function markAllReadForUser(userId) {
  const now = new Date();
  await UserNotification.update(
    { read: true, viewedAt: now },
    { where: { userId, archived: false, read: false } },
  );
  return { ok: true };
}

export async function archiveForUser(userId, id) {
  const row = await UserNotification.findOne({ where: { id, userId } });
  if (!row) return false;
  await row.update({ archived: true, read: true });
  return true;
}

export async function archiveForUserByIdOrDedup(userId, idOrDedup) {
  if (UUID_RE.test(String(idOrDedup))) {
    return archiveForUser(userId, idOrDedup);
  }
  const row = await UserNotification.findOne({
    where: { userId, clientDedupKey: String(idOrDedup) },
  });
  if (!row) return false;
  await row.update({ archived: true, read: true });
  return true;
}

export async function patchLifecycleForUser(userId, id, body) {
  const row = await UserNotification.findOne({ where: { id, userId, archived: false } });
  if (!row) return null;
  const patch = {};
  if (body.viewedAt !== undefined) patch.viewedAt = body.viewedAt ? new Date(body.viewedAt) : null;
  if (body.acknowledgedAt !== undefined) {
    patch.acknowledgedAt = body.acknowledgedAt ? new Date(body.acknowledgedAt) : null;
  }
  if (body.resolvedAt !== undefined) patch.resolvedAt = body.resolvedAt ? new Date(body.resolvedAt) : null;
  await row.update(patch);
  return toApi(await row.reload());
}

export async function bulkInsertNotifications(rows) {
  if (!rows?.length) return { inserted: 0, skipped: 0, rows: [] };
  const result = await UserNotification.bulkCreate(rows, {
    validate: true,
    ignoreDuplicates: true,
  });
  return {
    inserted: result.length,
    skipped: rows.length - result.length,
    rows: result.map((r) => toApi(typeof r.toJSON === 'function' ? r.toJSON() : r)),
  };
}

/**
 * Load persisted rows for dedup keys (after bulk insert with ignoreDuplicates).
 * @param {number} userId
 * @param {string[]} clientDedupKeys full keys including userId prefix
 */
export async function findByClientDedupKeys(userId, clientDedupKeys) {
  const keys = [...new Set(clientDedupKeys.filter(Boolean))];
  if (!keys.length) return [];
  const rows = await UserNotification.findAll({
    where: {
      userId,
      clientDedupKey: { [Op.in]: keys },
      archived: false,
    },
  });
  return rows.map((r) => toApi(typeof r.toJSON === 'function' ? r.toJSON() : r));
}

/**
 * Insert (ignore dupes) then return API rows for each dedup key.
 */
export async function persistNotificationRows(rows) {
  if (!rows?.length) return [];

  const { rows: insertedRows } = await bulkInsertNotifications(rows);

  const byUser = new Map();
  for (const row of rows) {
    if (!row.clientDedupKey) continue;
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    byUser.get(row.userId).push(row.clientDedupKey);
  }

  const byId = new Map();
  for (const apiRow of insertedRows) {
    if (apiRow?.id) byId.set(apiRow.id, apiRow);
  }

  for (const [userId, keys] of byUser) {
    const found = await findByClientDedupKeys(userId, keys);
    for (const apiRow of found) {
      if (apiRow?.id) byId.set(apiRow.id, apiRow);
    }
  }

  const out = [];
  for (const row of rows) {
    const match = [...byId.values()].find(
      (r) => r.userId === row.userId && r.clientDedupKey === row.clientDedupKey,
    );
    if (match) out.push(match);
  }
  return out;
}

export async function markReadForUserByIdOrDedup(userId, idOrDedup) {
  if (UUID_RE.test(String(idOrDedup))) {
    return markReadForUser(userId, idOrDedup);
  }
  const row = await UserNotification.findOne({
    where: { userId, clientDedupKey: String(idOrDedup), archived: false },
  });
  if (!row) return null;
  const now = new Date();
  await row.update({
    read: true,
    viewedAt: row.viewedAt || now,
  });
  return toApi(await row.reload());
}

export async function syncNotificationsForUser(userId, query = {}, companyId = null) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 200);
  const where = {
    userId,
    archived: false,
  };
  if (companyId) {
    where.tenantId = companyId;
  }
  const hasSince = query.since && !Number.isNaN(new Date(query.since).getTime());
  if (hasSince) {
    where.createdAt = { [Op.gte]: new Date(query.since) };
  }
  const rows = await UserNotification.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
  });
  const items = rows.map(toApi);
  let nextSyncFrom = new Date().toISOString();
  if (items.length) {
    const maxTs = items.reduce((max, item) => {
      const t = new Date(item.createdAt || 0).getTime();
      return t > max ? t : max;
    }, 0);
    if (maxTs > 0) nextSyncFrom = new Date(maxTs).toISOString();
  }
  return {
    items,
    serverTime: new Date().toISOString(),
    nextSyncFrom,
  };
}
