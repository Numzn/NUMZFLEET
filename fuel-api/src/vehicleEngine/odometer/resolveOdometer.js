/**
 * Odometer resolution modes (M2 §7).
 */

/**
 * @param {{ anchorKm: number|null, anchorTelemetryKm: number|null, currentTelemetryKm: number|null }}
 */
export function resolveOdometerKm({ anchorKm, anchorTelemetryKm, currentTelemetryKm }) {
  const hasAnchor = anchorKm != null
    && anchorTelemetryKm != null
    && currentTelemetryKm != null;

  if (hasAnchor) {
    const delta = currentTelemetryKm - Number(anchorTelemetryKm);
    const odometerKm = Number(anchorKm) + (delta > 0 ? delta : 0);
    return {
      odometerKm: Number(odometerKm.toFixed(1)),
      resolutionMode: 'anchored',
    };
  }

  if (currentTelemetryKm != null) {
    return {
      odometerKm: Number(currentTelemetryKm.toFixed(1)),
      resolutionMode: 'telemetry_only',
    };
  }

  if (anchorKm != null) {
    return {
      odometerKm: Number(Number(anchorKm).toFixed(1)),
      resolutionMode: 'anchored',
    };
  }

  return {
    odometerKm: null,
    resolutionMode: 'unavailable',
  };
}
