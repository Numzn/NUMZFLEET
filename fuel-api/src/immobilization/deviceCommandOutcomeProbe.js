import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { getTraccarCommandResultsSince } from '../config/traccar.js';
import { logImmobilization } from './immobilizationLog.js';

export function isAckProbeEnabled() {
  const raw = process.env.IMMOBILIZATION_ACK_PROBE;
  if (raw === undefined || raw === '') return true;
  return raw !== '0' && raw.toLowerCase() !== 'false';
}

export function getAckProbeWindowSec() {
  const raw = process.env.IMMOBILIZATION_ACK_PROBE_WINDOW_SEC;
  const n = raw === undefined || raw === '' ? 900 : parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 900;
}

/**
 * How long the sweep keeps *retrying* a completed intent (getAckProbeWindowSec,
 * above) is a different question from how close a given commandResult event
 * has to land to plausibly BE this command's result. Traccar's tc_events has
 * no command identifier — attributes is just protocol-specific raw text
 * (verified: a real row is `{"result":"S20,OK,190531"}`) — so a device ACK
 * genuinely arriving minutes after delivery is indistinguishable from an
 * unrelated later event without *some* bound. This is that bound.
 */
export function getAckMatchWindowSec() {
  const raw = process.env.IMMOBILIZATION_ACK_MATCH_WINDOW_SEC;
  const n = raw === undefined || raw === '' ? 120 : parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

/**
 * Events plausibly attributable to a command delivered at `sinceMs`: not
 * before delivery, and within `matchWindowMs` after it. Sorted earliest
 * first — the event closest to delivery is the most plausible candidate,
 * not just whichever is most recent overall.
 *
 * @param {Array<{ eventtime: Date|string }>} events
 * @param {{ sinceMs: number, matchWindowMs: number }} bounds
 */
export function selectPlausibleAckEvents(events, { sinceMs, matchWindowMs }) {
  return (events || [])
    .map((ev) => ({ ev, t: new Date(ev.eventtime).getTime() }))
    .filter(({ t }) => Number.isFinite(t) && t >= sinceMs && t <= sinceMs + matchWindowMs)
    .sort((a, b) => a.t - b.t)
    .map(({ ev }) => ev);
}

/**
 * Whether a Traccar commandResult event plausibly acknowledges a sent engine command.
 * @param {{ attributes?: object|string }} event
 * @param {string|null} commandType engineStop | engineResume | custom
 */
export function commandResultLooksLikeAck(event, commandType = null) {
  if (!event || event.type !== 'commandResult') return false;
  const attrs = event.attributes;
  const result = typeof attrs === 'object' && attrs != null
    ? String(attrs.result || attrs.message || '')
    : String(attrs || '');
  const normalized = result.toLowerCase();
  if (!normalized.trim()) return true;
  if (/(fail|error|timeout|reject|denied|invalid)/i.test(normalized)) return false;
  if (!commandType) return true;
  if (commandType === 'engineStop' && /(stop|immobil|cut|relay|ok|success)/i.test(normalized)) {
    return true;
  }
  if (commandType === 'engineResume' && /(resume|start|mobil|relay|ok|success)/i.test(normalized)) {
    return true;
  }
  if (commandType === 'custom') return true;
  return /^(ok|success|done|accepted)/i.test(normalized.trim());
}

/**
 * Whether another intent on the same device had its command delivered
 * strictly between `fromMs` (exclusive) and `toMs` (inclusive). If so, a
 * commandResult event landing at `toMs` is at least as plausibly that
 * command's result as ours — Traccar gives us no way to tell them apart, so
 * the honest move is to refuse the match rather than guess.
 */
export async function hasCompetingDeliveryBetween(deviceId, intentId, fromMs, toMs) {
  const rows = await sequelize.query(
    `SELECT id FROM vehicle_immobilization_intents
     WHERE "deviceId" = :deviceId
       AND id != :intentId
       AND "traccarDeliveryAt" IS NOT NULL
       AND "traccarDeliveryAt" > :fromDate
       AND "traccarDeliveryAt" <= :toDate
     LIMIT 1`,
    {
      replacements: {
        deviceId,
        intentId,
        fromDate: new Date(fromMs),
        toDate: new Date(toMs),
      },
      type: QueryTypes.SELECT,
    },
  );
  return rows.length > 0;
}

/**
 * Upgrade confidence to relay_reported when Traccar reports commandResult after delivery.
 *
 * Correlation is inherently best-effort: Traccar's tc_events carries no
 * command identifier, only deviceId + timestamp + raw protocol text. Two
 * guards keep that honest rather than optimistic: (1) the event must land
 * within a bounded window after our delivery, closest-first, not just be
 * the most recent event ever seen on the device; (2) if any other intent on
 * the same device was delivered in between, the event is ambiguous and is
 * refused rather than attributed to us.
 *
 * @param {object} intentRow DB row (completed, confidence sent)
 * @returns {Promise<boolean>}
 */
export async function probeDeviceCommandOutcome(intentRow) {
  if (!isAckProbeEnabled() || !intentRow?.id) return false;
  if (intentRow.confidence !== 'sent' || intentRow.status !== 'completed') return false;

  const since = intentRow.traccarDeliveryAt || intentRow.executionStartedAt;
  if (!since) return false;
  const sinceMs = new Date(since).getTime();
  if (!Number.isFinite(sinceMs)) return false;

  const events = await getTraccarCommandResultsSince(intentRow.deviceId, since, 10);
  const candidates = selectPlausibleAckEvents(events, {
    sinceMs,
    matchWindowMs: getAckMatchWindowSec() * 1000,
  });
  if (candidates.length === 0) return false;

  let payload = intentRow.traccarCommandPayload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  const commandType = intentRow.traccarCommandType || payload?.type || null;

  for (const event of candidates) {
    if (!commandResultLooksLikeAck(event, commandType)) continue;
    const eventMs = new Date(event.eventtime).getTime();
    // eslint-disable-next-line no-await-in-loop
    const ambiguous = await hasCompetingDeliveryBetween(intentRow.deviceId, intentRow.id, sinceMs, eventMs);
    if (ambiguous) {
      logImmobilization('immobilization.intent.ack_ambiguous', {
        intentId: intentRow.id,
        deviceId: intentRow.deviceId,
        eventId: event.id ?? null,
      });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const rows = await sequelize.query(
      `UPDATE vehicle_immobilization_intents
       SET confidence = 'relay_reported',
           "updatedAt" = NOW()
       WHERE id = :id AND status = 'completed' AND confidence = 'sent'
       RETURNING id`,
      {
        replacements: { id: intentRow.id },
        type: QueryTypes.SELECT,
      },
    );
    const updated = Array.isArray(rows) && rows.length > 0;
    if (updated) {
      logImmobilization('immobilization.intent.ack', {
        intentId: intentRow.id,
        deviceId: intentRow.deviceId,
        commandType,
        eventId: event.id ?? null,
      });
    }
    return updated;
  }

  return false;
}

/**
 * Late commandResult events: sweep recently completed intents still at confidence sent.
 */
export async function probeRecentSentIntents() {
  if (!isAckProbeEnabled()) return { probed: 0, upgraded: 0 };

  const windowSec = getAckProbeWindowSec();
  const cutoff = new Date(Date.now() - windowSec * 1000);
  const rows = await sequelize.query(
    `SELECT * FROM vehicle_immobilization_intents
     WHERE status = 'completed'
       AND confidence = 'sent'
       AND "executionCompletedAt" IS NOT NULL
       AND "executionCompletedAt" > :cutoff
     ORDER BY "executionCompletedAt" DESC
     LIMIT 5`,
    {
      replacements: { cutoff },
      type: QueryTypes.SELECT,
    },
  );

  let upgraded = 0;
  for (const row of rows) {
    if (await probeDeviceCommandOutcome(row)) upgraded += 1;
  }
  return { probed: rows.length, upgraded };
}
