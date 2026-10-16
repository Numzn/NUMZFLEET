/**
 * Odometer resolution modes (M2 §7).
 */

/**
 * @param {{ anchorKm: number|null, anchorTelemetryKm: number|null, currentTelemetryKm: number|null }}
 */
export function resolveOdometerKm({ anchorKm, anchorTelemetryKm, currentTelemetryKm }) {
  // The vehicle has an accepted mileage but its tracker has no counter reference yet (a replacement
  // tracker that has not reported since hand-over). Whatever the tracker's own counter reads is not
  // this vehicle's odometer, so the accepted value holds until the baseline is established.
  if (anchorKm != null && anchorTelemetryKm == null) {
    return {
      odometerKm: Number(Number(anchorKm).toFixed(1)),
      resolutionMode: 'anchored',
    };
  }

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
