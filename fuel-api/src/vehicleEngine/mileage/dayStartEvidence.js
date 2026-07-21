import { getTraccarPool } from '../../config/traccar.js';
import { extractTelemetryEvidence } from '../odometer/normaliseEvidence.js';
import { resolveOdometerFromEvidence } from '../odometer/resolveVehicleOdometer.js';
import { detectUnitMismatch } from '../odometer/validateEvidence.js';

const LOOKBACK_MS = 48 * 60 * 60 * 1000;
const EXACT_TOLERANCE_MS = 2 * 60 * 1000;

function parseAttributes(row) {
  if (!row?.attributes) return {};
  if (typeof row.attributes === 'object') return row.attributes;
  try {
    return JSON.parse(row.attributes);
  } catch {
    return {};
  }
}

/**
 * Last position at/before `boundary`, within a bounded lookback — never an
 * unbounded scan, and never further back than we're willing to trust.
 */
async function fetchLastPositionBefore(deviceId, boundary) {
  const pool = getTraccarPool();
  const from = new Date(boundary.getTime() - LOOKBACK_MS);
  const [rows] = await pool.execute(
    `SELECT id, fixtime, attributes FROM tc_positions
     WHERE deviceid = ? AND fixtime <= ? AND fixtime >= ?
     ORDER BY fixtime DESC LIMIT 1`,
    [deviceId, boundary, from],
  );
  return rows[0] ?? null;
}

/** First position after `boundary`, within a bounded lookforward — fallback only. */
async function fetchFirstPositionAfter(deviceId, boundary) {
  const pool = getTraccarPool();
  const to = new Date(boundary.getTime() + LOOKBACK_MS);
  const [rows] = await pool.execute(
    `SELECT id, fixtime, attributes FROM tc_positions
     WHERE deviceid = ? AND fixtime > ? AND fixtime <= ?
     ORDER BY fixtime ASC LIMIT 1`,
    [deviceId, boundary, to],
  );
  return rows[0] ?? null;
}

/**
 * Reconstruct the odometer as of a local-day boundary from Traccar's
 * retained position history — not a live scheduler sample, so it stays
 * correct no matter when this function actually runs (backend restart,
 * late job, etc.).
 * @param {{ deviceId: number, boundary: Date, anchorKm: number|null, anchorTelemetryKm: number|null }}
 * @returns {Promise<{ odometerKm: number|null, source: string, evidenceFixtime: Date|null, confidence: string }>}
 */
export async function resolveDayStartOdometer({ deviceId, boundary, anchorKm, anchorTelemetryKm }) {
  if (deviceId == null) {
    return { odometerKm: null, source: 'unavailable', evidenceFixtime: null, confidence: 'unavailable', telemetryKm: null };
  }

  let row = await fetchLastPositionBefore(deviceId, boundary);
  let source = 'nearest_before';

  if (!row) {
    row = await fetchFirstPositionAfter(deviceId, boundary);
    source = 'nearest_after';
  }

  if (!row) {
    return { odometerKm: null, source: 'unavailable', evidenceFixtime: null, confidence: 'unavailable', telemetryKm: null };
  }

  if (source === 'nearest_before') {
    const gapMs = boundary.getTime() - new Date(row.fixtime).getTime();
    if (gapMs <= EXACT_TOLERANCE_MS) source = 'exact_boundary';
  }

  const attrs = parseAttributes(row);
  const extracted = extractTelemetryEvidence(attrs);
  const unit = detectUnitMismatch(extracted.attribute, extracted.km, anchorKm ?? null);

  const state = resolveOdometerFromEvidence({
    telemetryKm: unit.correctedKm,
    telemetryAttribute: extracted.attribute,
    anchor: anchorKm != null ? { anchorKm, anchorTelemetryKm: anchorTelemetryKm ?? null } : null,
    hasObservation: anchorKm != null,
    latestObservationKm: anchorKm ?? null,
    device: null,
    position: { fixTime: row.fixtime },
  });

  return {
    odometerKm: state.odometerKm,
    source,
    evidenceFixtime: new Date(row.fixtime),
    confidence: state.odometerConfidence,
    telemetryKm: state.telemetryKm ?? null,
  };
}
