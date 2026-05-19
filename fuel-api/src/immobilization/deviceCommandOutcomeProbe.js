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
 * Upgrade confidence to relay_reported when Traccar reports commandResult after delivery.
 * @param {object} intentRow DB row (completed, confidence sent)
 * @returns {Promise<boolean>}
 */
export async function probeDeviceCommandOutcome(intentRow) {
  if (!isAckProbeEnabled() || !intentRow?.id) return false;
  if (intentRow.confidence !== 'sent' || intentRow.status !== 'completed') return false;

  const since = intentRow.traccarDeliveryAt || intentRow.executionStartedAt;
  if (!since) return false;

  const events = await getTraccarCommandResultsSince(
    intentRow.deviceId,
    since,
    10,
  );
  let payload = intentRow.traccarCommandPayload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  const commandType = intentRow.traccarCommandType || payload?.type || null;
  const ack = events.some((ev) => commandResultLooksLikeAck(ev, commandType));
  if (!ack) return false;

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
    });
  }
  return updated;
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
