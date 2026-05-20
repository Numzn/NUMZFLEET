import { getTraccarPool } from '../../config/traccar.js';

function parseEventAttributes(row) {
  if (!row?.attributes) return;
  if (typeof row.attributes === 'object') return;
  try {
    row.attributes = JSON.parse(row.attributes);
  } catch {
    /* keep string */
  }
}

/**
 * @param {{ cursorId: number, lookbackHours?: number, batchSize?: number }} opts
 */
export async function fetchTraccarEventsAfterCursor(opts) {
  const cursorId = Number(opts.cursorId) || 0;
  const batchSize = Math.min(Math.max(Number(opts.batchSize) || 100, 1), 500);
  const lookbackHours = Math.min(Math.max(Number(opts.lookbackHours) || 48, 1), 168);
  const lookback = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const pool = getTraccarPool();
  const [rows] = await pool.execute(
    `SELECT id, deviceid, type, eventtime, attributes
     FROM tc_events
     WHERE id > ? AND eventtime >= ?
     ORDER BY id ASC
     LIMIT ${batchSize}`,
    [cursorId, lookback],
  );
  rows.forEach(parseEventAttributes);
  return rows;
}
