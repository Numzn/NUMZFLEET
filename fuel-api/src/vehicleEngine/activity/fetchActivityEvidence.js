import { getTraccarPool } from '../../config/traccar.js';
import { isTraccarCommandApiConfigured, traccarFetch } from '../../services/traccarCommandService.js';

function parseEventAttributes(row) {
  if (!row?.attributes) return;
  if (typeof row.attributes === 'object') return;
  try {
    row.attributes = JSON.parse(row.attributes);
  } catch {
    /* keep string */
  }
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Traccar tc_events for one device in a time window.
 *
 * order defaults to ASC (chronological, for feed-style callers). A busy
 * device can have far more than `limit` events in a wide window, so ASC +
 * LIMIT returns the *oldest* events in range, not the ones nearest `to` —
 * callers that want "the most recent matching event" (e.g. reconstructing
 * when a state transition actually happened) must pass order: 'DESC' and
 * read from the front of the result, not ASC + take-the-last-match.
 *
 * @param {{ deviceId: number, from: Date, to: Date, limit?: number, order?: 'ASC'|'DESC' }}
 */
export async function fetchDeviceEvents({ deviceId, from, to, limit = 250, order = 'ASC' }) {
  if (deviceId == null) return [];
  const cap = Math.min(Math.max(1, limit), 500);
  const direction = order === 'DESC' ? 'DESC' : 'ASC';
  const pool = getTraccarPool();
  const [rows] = await pool.execute(
    `SELECT id, type, eventtime, attributes
     FROM tc_events
     WHERE deviceid = ? AND eventtime >= ? AND eventtime <= ?
     ORDER BY eventtime ${direction}
     LIMIT ${cap}`,
    [Number(deviceId), from, to],
  );
  rows.forEach(parseEventAttributes);
  return rows.map((row) => ({
    id: Number(row.id),
    type: String(row.type || '').trim(),
    occurredAt: toIso(row.eventtime),
    attributes: row.attributes ?? {},
  }));
}

/**
 * Traccar trips report for one device (server-side service account).
 * @param {{ deviceId: number, from: Date, to: Date }}
 */
export async function fetchDeviceTrips({ deviceId, from, to }) {
  if (deviceId == null || !isTraccarCommandApiConfigured()) return [];

  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: from.toISOString(),
    to: to.toISOString(),
  });

  try {
    const response = await traccarFetch(`/api/reports/trips?${params.toString()}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((trip) => ({
      deviceId: trip.deviceId != null ? Number(trip.deviceId) : Number(deviceId),
      startTime: toIso(trip.startTime),
      endTime: toIso(trip.endTime),
      distance: trip.distance != null ? Number(trip.distance) : null,
      averageSpeed: trip.averageSpeed != null ? Number(trip.averageSpeed) : null,
      maxSpeed: trip.maxSpeed != null ? Number(trip.maxSpeed) : null,
      startAddress: trip.startAddress ?? null,
      endAddress: trip.endAddress ?? null,
    })).filter((t) => t.startTime);
  } catch {
    return [];
  }
}

/**
 * @param {{ deviceId: number|null, windowHours?: number }}
 */
export async function fetchActivityEvidence({ deviceId, windowHours = 24 }) {
  if (deviceId == null) {
    return { events: [], trips: [], windowStart: null, windowEnd: null };
  }

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowHours * 60 * 60 * 1000);

  const [events, trips] = await Promise.all([
    fetchDeviceEvents({ deviceId: Number(deviceId), from: windowStart, to: windowEnd }),
    fetchDeviceTrips({ deviceId: Number(deviceId), from: windowStart, to: windowEnd }),
  ]);

  return {
    events,
    trips: trips.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };
}
