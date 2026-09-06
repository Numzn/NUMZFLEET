import { DELIVERY_STATUS } from '../deliveryStates.js';

/**
 * Parses events from the real SMS gateway (capcom6/android-sms-gateway,
 * smsProvider.js) into normalized provider events — the ONLY place that
 * knows this gateway's own field names and event vocabulary. Nothing
 * downstream (deliveryLifecycleService.js, the webhook route) ever sees a
 * raw gateway payload shape.
 *
 * Verified directly against this gateway, not assumed from a similar
 * provider's docs:
 *   - Webhook body shape and the four outbound events (sms:sent,
 *     sms:delivered, sms:failed, sms:cancelled), each with an event-specific
 *     timestamp field name — https://docs.sms-gate.app/features/webhooks/.
 *   - The status-lookup response shape (GET /api/3rdparty/v1/messages/:id)
 *     and its real state vocabulary (Pending, Processed, Sent, Delivered) —
 *     read live from the gateway this session (message history at
 *     SMS_GATEWAY_BASE_URL, four real messages, two of which had genuinely
 *     reached "Delivered").
 *
 * `PROVIDER` matches CHANNEL_PROVIDER[CHANNELS.SMS] in deliveryRecorder.js
 * exactly — this is how a normalized event's provider field lines up with
 * what recordAttempt() already stamped on the attempt row at send time.
 */
export const PROVIDER = 'numz-sms-gateway';

/**
 * `sms:cancelled` is deliberately mapped to FAILED, not our own CANCELLED:
 * our CANCELLED means "we chose not to attempt this" (Phase 5's planner) —
 * a provider-side cancellation is the opposite, a real attempt that did not
 * reach the carrier, and deliveryStates.js's own transition table only
 * allows SENT -> [DELIVERED, FAILED] anyway (CANCELLED is not reachable from
 * SENT, and by the time a webhook can exist we are always already at SENT
 * or later). Keeping the provider's word out of our own vocabulary here is
 * the point of this adapter existing at all.
 */
const WEBHOOK_EVENT_MAP = Object.freeze({
  'sms:sent': { status: DELIVERY_STATUS.SENT, timestampField: 'sentAt' },
  'sms:delivered': { status: DELIVERY_STATUS.DELIVERED, timestampField: 'deliveredAt' },
  'sms:failed': {
    status: DELIVERY_STATUS.FAILED, timestampField: 'failedAt', failureCode: 'provider_failed',
  },
  'sms:cancelled': {
    status: DELIVERY_STATUS.FAILED, timestampField: 'cancelledAt', failureCode: 'provider_cancelled',
  },
});

function parseTimestamp(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * @param {unknown} body the raw HTTP request body
 * @returns {{ ok: true, event: NormalizedProviderEvent } | { ok: false, reason: string }}
 *
 * @typedef {object} NormalizedProviderEvent
 * @property {string} provider
 * @property {string} providerMessageId
 * @property {string} status one of DELIVERY_STATUS
 * @property {string|null} failureCode
 * @property {string|null} failureReason
 * @property {Date|null} occurredAt
 * @property {object} raw the original payload, kept for audit
 */
export function parseWebhookPayload(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'malformed_body' };
  }

  const { event, payload } = body;
  if (typeof event !== 'string' || !event) {
    return { ok: false, reason: 'missing_event' };
  }

  const mapping = WEBHOOK_EVENT_MAP[event];
  if (!mapping) {
    // A real, but currently-unhandled or future event (e.g. sms:received —
    // inbound, not relevant to an outbound delivery's lifecycle). Not an
    // error: the caller must still 2xx so the gateway does not retry forever.
    return { ok: false, reason: 'unknown_event' };
  }

  const messageId = payload?.messageId;
  if (!messageId || typeof messageId !== 'string') {
    return { ok: false, reason: 'missing_message_id' };
  }

  return {
    ok: true,
    event: {
      provider: PROVIDER,
      providerMessageId: messageId,
      status: mapping.status,
      failureCode: mapping.failureCode || null,
      failureReason: mapping.failureCode ? (payload?.reason || null) : null,
      occurredAt: parseTimestamp(payload?.[mapping.timestampField]),
      raw: body,
    },
  };
}

/**
 * Same normalization for the status-lookup response (GET
 * /api/3rdparty/v1/messages/:id, smsProvider.js's getSmsStatus) — the
 * reconciliation path's input, distinct from the webhook path's but landing
 * on the exact same NormalizedProviderEvent shape so deliveryLifecycleService.js
 * has only one thing to consume regardless of which path produced it.
 *
 * The real response nests state per-recipient (`recipients: [{ phoneNumber,
 * state }]`) as well as a top-level `state` — every notification here always
 * sends to exactly one recipient, so the top-level state is authoritative and
 * sufficient; per-recipient detail is kept in `raw` for audit, not parsed out.
 *
 * @param {string} messageId the id we already have on our own attempt row —
 *   passed in rather than read from the response, since a status-lookup
 *   response does not echo back the id you asked for by that name.
 * @param {unknown} body the raw getSmsStatus() response
 */
export function parseStatusResponse(messageId, body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'malformed_body' };
  }
  const state = body.state;
  if (typeof state !== 'string' || !state) {
    return { ok: false, reason: 'missing_state' };
  }

  // Pending/Processed are still in flight — nothing for the lifecycle service
  // to do yet; the reconciliation job should simply try again next tick.
  if (state === 'Pending' || state === 'Processed') {
    return { ok: false, reason: 'still_in_flight' };
  }

  const STATUS_MAP = {
    Sent: { status: DELIVERY_STATUS.SENT, timestampKey: 'Sent' },
    Delivered: { status: DELIVERY_STATUS.DELIVERED, timestampKey: 'Delivered' },
    Failed: { status: DELIVERY_STATUS.FAILED, timestampKey: 'Failed', failureCode: 'provider_failed' },
    // See the identical reasoning on sms:cancelled above.
    Cancelled: { status: DELIVERY_STATUS.FAILED, timestampKey: 'Cancelled', failureCode: 'provider_cancelled' },
  };
  const mapping = STATUS_MAP[state];
  if (!mapping) {
    return { ok: false, reason: 'unknown_state' };
  }

  const recipientReason = Array.isArray(body.recipients)
    ? body.recipients.find((r) => r && r.state === state)?.error
    : null;

  return {
    ok: true,
    event: {
      provider: PROVIDER,
      providerMessageId: messageId,
      status: mapping.status,
      failureCode: mapping.failureCode || null,
      failureReason: mapping.failureCode ? (recipientReason || null) : null,
      occurredAt: parseTimestamp(body?.states?.[mapping.timestampKey]),
      raw: body,
    },
  };
}
