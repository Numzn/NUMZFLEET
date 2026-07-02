/**
 * Telemetry evidence normalisation (M2 §4.2, §5).
 * All published odometer values are kilometres.
 */

const TELEMETRY_ATTR_PRIORITY = ['odometer', 'totalDistance', 'mileage'];

/**
 * @param {Record<string, unknown>|null|undefined} attrs
 * @returns {{ attribute: string|null, rawValue: number|null, km: number|null }}
 */
export function extractTelemetryEvidence(attrs) {
  if (!attrs || typeof attrs !== 'object') {
    return { attribute: null, rawValue: null, km: null };
  }

  for (const key of TELEMETRY_ATTR_PRIORITY) {
    const raw = attrs[key];
    if (raw == null || raw === '') continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) continue;
    return {
      attribute: key,
      rawValue: num,
      km: rawTelemetryToKm(num, key),
    };
  }

  return { attribute: null, rawValue: null, km: null };
}

/**
 * Convert a raw tracker value to km based on which attribute it came from.
 */
export function rawTelemetryToKm(value, attribute) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  if (attribute === 'totalDistance') {
    return Number((n / 1000).toFixed(1));
  }

  // odometer / mileage: fleet context usually km; very large values treated as metres
  if (n >= 500_000) {
    return Number((n / 1000).toFixed(1));
  }

  return Number(n.toFixed(1));
}

/**
 * Normalise legacy anchor telemetry stored before km-normalised anchors.
 */
export function legacyAnchorTelemetryToKm(stored) {
  if (stored == null || !Number.isFinite(Number(stored))) return null;
  const n = Number(stored);
  if (n >= 500_000) {
    return Number((n / 1000).toFixed(1));
  }
  return Number(n.toFixed(1));
}
