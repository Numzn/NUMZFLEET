import { Op } from 'sequelize';
import { LoginAuditEvent } from '../models/index.js';

/**
 * Shared by auth/loginController.js (write, on every login attempt) and the
 * profile module's login-history endpoint (read). Never throws — a failed
 * audit write must never fail the login itself.
 */
export async function recordLoginAttempt({
  traccarUserId, companyId, email, outcome, method = 'password', ip, userAgent,
}) {
  try {
    await LoginAuditEvent.create({
      traccarUserId: traccarUserId ?? null,
      companyId: companyId ?? null,
      email: email || null,
      outcome,
      method,
      ip: ip || null,
      userAgent: userAgent || null,
    });
  } catch (e) {
    console.warn('[loginAuditService] failed to record login attempt:', e?.message || e);
  }
}

/**
 * Matches by traccar_user_id (successful logins, once identity is known) OR
 * email (also surfaces failed attempts against this account, which never
 * resolve a traccar_user_id) — otherwise failed-attempt rows would be
 * orphaned and never shown to anyone.
 */
export async function listLoginHistoryForUser(traccarUserId, email, { limit = 20, before } = {}) {
  const cappedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const conditions = [];
  if (traccarUserId) conditions.push({ traccarUserId });
  if (email) conditions.push({ email });
  if (!conditions.length) return { items: [] };

  const where = { [Op.or]: conditions };
  if (before) {
    const beforeDate = new Date(before);
    if (!Number.isNaN(beforeDate.getTime())) {
      where.occurredAt = { [Op.lt]: beforeDate };
    }
  }

  const rows = await LoginAuditEvent.findAll({
    where,
    order: [['occurredAt', 'DESC']],
    limit: cappedLimit,
  });

  return {
    items: rows.map((r) => ({
      id: r.id,
      outcome: r.outcome,
      method: r.method,
      ip: r.ip,
      userAgent: r.userAgent,
      occurredAt: r.occurredAt,
    })),
  };
}
