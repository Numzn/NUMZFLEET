import { Op } from 'sequelize';
import { UserNotification } from '../../models/index.js';

function toApi(row) {
  if (!row) return null;
  const j = typeof row.toJSON === 'function' ? row.toJSON() : row;
  const iso = (d) => {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString();
    return d;
  };
  return {
    id: j.id,
    userId: j.userId,
    type: j.type,
    category: j.category,
    severity: j.severity,
    title: j.title,
    message: j.message,
    source: j.source,
    metadata: j.metadata || {},
    read: !!j.read,
    archived: !!j.archived,
    viewedAt: iso(j.viewedAt),
    acknowledgedAt: iso(j.acknowledgedAt),
    resolvedAt: iso(j.resolvedAt),
    createdAt: iso(j.createdAt),
    updatedAt: iso(j.updatedAt),
  };
}

export async function listNotificationsForUser(userId, query) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 40, 1), 100);
  const where = {
    userId,
    archived: false,
  };
  if (query.category) where.category = query.category;
  if (query.severity) where.severity = query.severity;
  if (query.read === 'true') where.read = true;
  if (query.read === 'false') where.read = false;

  if (query.before) {
    const d = new Date(query.before);
    if (!Number.isNaN(d.getTime())) {
      where.createdAt = { [Op.lt]: d };
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
  if (!rows?.length) return;
  await UserNotification.bulkCreate(rows, { validate: true });
}
