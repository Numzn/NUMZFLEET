/**
 * Evidence validation flags (M2 §6).
 */

const STALE_MS = 5 * 60 * 1000;

/**
 * @param {{ device?: { status?: string, lastUpdate?: string|null }|null, position?: { fixTime?: string|null }|null }}
 */
export function validateTelemetryFreshness({ device, position }) {
  const diagnostics = [];
  let stale = false;

  const lastUpdate = device?.lastUpdate ?? position?.fixTime ?? null;
  if (!lastUpdate) {
    diagnostics.push('stale_telemetry');
    stale = true;
  } else {
    const age = Date.now() - new Date(lastUpdate).getTime();
    if (age > STALE_MS && device?.status !== 'online') {
      diagnostics.push('stale_telemetry');
      stale = true;
    }
  }

  return { stale, diagnostics };
}

/**
 * @param {number|null} anchorTelemetryKm
 * @param {number|null} currentTelemetryKm
 */
export function detectResetSuspected(anchorTelemetryKm, currentTelemetryKm) {
  if (anchorTelemetryKm == null || currentTelemetryKm == null) {
    return { resetSuspected: false, diagnostics: [] };
  }
  if (currentTelemetryKm < anchorTelemetryKm) {
    return { resetSuspected: true, diagnostics: ['reset_suspected'] };
  }
  return { resetSuspected: false, diagnostics: [] };
}

export function detectUnitSuspicion(attribute) {
  if (!attribute) return { diagnostics: [] };
  return { diagnostics: [] };
}
