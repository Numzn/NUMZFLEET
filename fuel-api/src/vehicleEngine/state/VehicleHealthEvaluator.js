/**
 * Conservative health checks over a resolved vehicle state. Each check is a
 * narrow, explainable signal, not a scoring model — extend by adding a new
 * named check, not by generalizing these into a rules engine.
 */

// Mirrors the frontend's STALE_FIX_MS threshold
// (traccar-fleet-system/frontend/src/main/fleet/vehicleOperationalIndicators.js)
// — same 25-minute cutoff for "this GPS fix is too old to trust as current
// telemetry", kept in sync intentionally rather than invented fresh here.
const STALE_FIX_MS = 25 * 60 * 1000;

// Reconstruction only ever looks back a bounded window (48h at runtime, 14
// days for the one-off historical repair script) — a 'reconstructed' row
// implying a duration far beyond either window is almost certainly a stale
// artifact nobody actually verified, not a real fact. Env-overridable, same
// pattern as OPERATION_LOCK_GRACE_MINUTES.
const MAX_RECONSTRUCTED_DURATION_MS = Math.max(
  1,
  Number(process.env.VEHICLE_STATE_MAX_RECONSTRUCTED_DURATION_DAYS) || 30,
) * 24 * 60 * 60 * 1000;

/**
 * @param {{
 *   state: 'moving'|'idle'|'offline',
 *   telemetry?: { positionSpeed?: number|null, positionFixTime?: string|Date|null },
 *   confidence?: string,
 *   enteredAt?: string|Date|null,
 *   durationSeconds?: number|null,
 *   now?: number,
 * }} params
 * @returns {{ status: 'ok'|'warning', issues: string[] }}
 */
export function evaluateVehicleHealth({
  state, telemetry, confidence, enteredAt, durationSeconds, now = Date.now(),
}) {
  const issues = [];

  const fixTime = telemetry?.positionFixTime;
  if (state !== 'offline' && fixTime) {
    const age = now - new Date(fixTime).getTime();
    if (Number.isFinite(age) && age > STALE_FIX_MS) {
      issues.push('stale_telemetry');
    }
  }

  // Contradictory signal: engine reports offline, but the last known
  // position still shows a positive speed reading — worth flagging, not
  // silently resolving one way or the other.
  const speed = telemetry?.positionSpeed;
  if (state === 'offline' && speed != null && Number(speed) > 0) {
    issues.push('telemetry_conflict');
  }

  // Impossible situation, not just a stale-fix warning: telemetry evidence of
  // actual movement (a fix time after the state was supposed to have begun,
  // with a positive speed reading) while the classified state isn't
  // 'moving'. No threshold needed — this is a direct logical contradiction.
  if (
    state !== 'moving'
    && fixTime != null
    && enteredAt != null
    && speed != null
    && Number(speed) > 0
  ) {
    const fixTimeMs = new Date(fixTime).getTime();
    const enteredAtMs = new Date(enteredAt).getTime();
    if (Number.isFinite(fixTimeMs) && Number.isFinite(enteredAtMs) && fixTimeMs > enteredAtMs) {
      issues.push('state_contradicted_by_recent_telemetry');
    }
  }

  // A 'reconstructed' duration longer than the reconstruction window could
  // ever actually verify — likely a stale timestamp surviving from a bug,
  // not a genuinely confirmed multi-week idle/offline stretch.
  if (
    confidence === 'reconstructed'
    && durationSeconds != null
    && durationSeconds * 1000 > MAX_RECONSTRUCTED_DURATION_MS
  ) {
    issues.push('excessive_reconstructed_duration');
  }

  return {
    status: issues.length === 0 ? 'ok' : 'warning',
    issues,
  };
}
