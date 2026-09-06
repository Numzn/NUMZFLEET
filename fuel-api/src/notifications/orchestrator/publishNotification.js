import * as repo from '../../modules/notifications/notificationRepository.js';
import { CHANNELS } from '../contracts/notificationContract.js';
import { DEFAULT_COMPANY_ID } from '../../models/index.js';
import { resolveAudience } from './audienceResolver.js';
import { planDeliveries } from '../planner/deliveryPlanner.js';
import { dispatchNotificationChannels } from '../dispatcher/notificationDispatcher.js';
import { createNotification } from '../canonicalNotification.js';
import {
  recordPlannedDeliveries,
  recordInboxDelivered,
  recordDispatchResult,
} from '../delivery/deliveryRecorder.js';

/**
 * Central notification publish API.
 * @param {import('../contracts/notificationContract.js').PublishNotificationSpec} spec
 * @param {{ io?: import('socket.io').Server }} [ctx]
 */
export async function publishNotification(spec, ctx = {}) {
  const notification = createNotification(spec);
  const {
    type,
    category,
    severity,
    urgency,
    title,
    message,
    source,
    audience,
    metadata,
    clientDedupKey,
    channels = [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
    mandatory,
  } = notification;

  const userIds = await resolveAudience(audience);
  if (!userIds.length) {
    return { userIds: [], persisted: 0 };
  }

  // Distinct from the DEFAULT_COMPANY_ID fallback below: the planner's tenant/
  // company eligibility check only applies when the CALLER itself scoped this
  // notification to a real company (compliance, maintenance today) — not to
  // every other producer that still lands on the legacy default. See
  // recipientEligibility.js's own doc comment for the full reasoning.
  const explicitCompanyId = Boolean(spec.companyId || metadata?.companyId);

  const now = new Date();
  const rows = userIds.map((userId) => ({
    userId,
    type,
    category,
    severity,
    urgency,
    title,
    message,
    source,
    metadata,
    read: false,
    archived: false,
    mandatory: Boolean(mandatory),
    tenantId: spec.companyId || metadata?.companyId || DEFAULT_COMPANY_ID,
    clientDedupKey: `${userId}:${clientDedupKey}`,
    createdAt: now,
    updatedAt: now,
  }));

  let persistedApiRows = [];
  if (channels.includes(CHANNELS.INBOX) && rows.length) {
    persistedApiRows = await repo.persistNotificationRows(rows);
  }

  const persistedByUserDedup = new Map();
  for (const apiRow of persistedApiRows) {
    if (apiRow?.userId != null && apiRow.clientDedupKey) {
      persistedByUserDedup.set(`${apiRow.userId}:${apiRow.clientDedupKey}`, apiRow);
    }
  }

  const { io } = ctx;
  for (const row of rows) {
    const apiRow = persistedByUserDedup.get(`${row.userId}:${row.clientDedupKey}`);
    if (!apiRow?.id) {
      if (channels.some((c) => c !== CHANNELS.INBOX) && io) {
        console.warn('[notifications] skip websocket emit: no persisted row', {
          type,
          userId: row.userId,
          clientDedupKey: row.clientDedupKey,
        });
      }
      continue;
    }

    // The delivery planner: one decision per requested channel (deliver /
    // suppress / delay), covering recipient eligibility, preferences,
    // per-channel destination eligibility, and quiet hours — see
    // notifications/planner/deliveryPlanner.js. inbox is included in the
    // plan (not special-cased) so a recipient-eligibility failure (tenant
    // mismatch, inactive account) suppresses the durable record too, not
    // just the external channels.
    let plan = [];
    let deliveries = [];
    try {
      plan = await planDeliveries({
        userId: row.userId,
        companyId: row.tenantId,
        explicitCompanyId,
        category,
        channels,
        mandatory,
        metadata,
      });
      deliveries = await recordPlannedDeliveries({
        notificationId: apiRow.id,
        companyId: row.tenantId,
        recipientUserId: row.userId,
        plan,
      });
      if (channels.includes(CHANNELS.INBOX)) {
        await recordInboxDelivered(deliveries);
      }
    } catch (e) {
      // Delivery bookkeeping must never break notification delivery itself.
      console.error('[notifications] delivery record failed', e?.message || e);
    }

    const deliverable = new Set(plan.filter((p) => p.decision === 'deliver').map((p) => p.channel));

    // Websocket only. Push/SMS/email are now left as pending delivery rows for
    // the delivery worker — the request path no longer waits on an external
    // provider. Websocket stays inline because its whole value is immediacy and
    // it needs this process's live socket handle; it is best-effort realtime,
    // not durable delivery, and the worker never claims it.
    const inlineChannels = deliverable.has(CHANNELS.WEBSOCKET) ? [CHANNELS.WEBSOCKET] : [];
    if (!inlineChannels.length || !io) continue;

    const results = await dispatchNotificationChannels(io, row.userId, apiRow, inlineChannels);

    try {
      for (const [channel, result] of Object.entries(results || {})) {
        const delivery = deliveries.find((d) => d.channel === channel);
        if (delivery) await recordDispatchResult(delivery, result);
      }
    } catch (e) {
      console.error('[notifications] delivery outcome record failed', e?.message || e);
    }
  }

  return { userIds, persisted: persistedApiRows.length };
}
