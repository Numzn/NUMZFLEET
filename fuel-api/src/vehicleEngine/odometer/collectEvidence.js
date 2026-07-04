import { VehicleSpec } from '../../models/index.js';
import { getVehicleTelemetry } from '../../services/refuelTelemetryService.js';
import { extractTelemetryEvidence, legacyAnchorTelemetryToKm, rawTelemetryToKm } from './normaliseEvidence.js';

/**
 * Gather mileage evidence for one vehicle (M2 §4).
 * @param {{ merged: object, deviceId: number|null }}
 */
export async function collectEvidence({ merged, deviceId }) {
  const position = merged?.position ?? null;
  const device = merged?.device ?? null;

  let telemetryKm = null;
  let telemetryAttribute = null;

  // Prefer live Traccar attrs with full evidence priority (odometer → totalDistance → mileage).
  // Merged position telemetry only exposes totalDistance; using it first could ignore a
  // updating odometer/mileage field and leave anchored mileage stuck at the last observation.
  if (deviceId != null) {
    const live = await getVehicleTelemetry(deviceId);
    const attrs = live.positionAttributes;
    if (attrs) {
      const extracted = extractTelemetryEvidence(attrs);
      if (extracted.km != null) {
        telemetryKm = extracted.km;
        telemetryAttribute = extracted.attribute;
      }
    }
  }

  if (telemetryKm == null && position?.telemetry?.totalDistance != null) {
    const km = rawTelemetryToKm(position.telemetry.totalDistance, 'totalDistance');
    telemetryKm = km;
    telemetryAttribute = 'totalDistance';
  }

  let anchor = null;
  if (deviceId != null) {
    const spec = await VehicleSpec.findOne({ where: { deviceId: Number(deviceId) } });
    if (spec?.verifiedOdometerKm != null) {
      anchor = {
        anchorKm: Number(spec.verifiedOdometerKm),
        anchorTelemetryKm: legacyAnchorTelemetryToKm(spec.verifiedTraccarDistance),
        anchoredAt: spec.verifiedOdometerAt ?? null,
        anchorSource: spec.verifiedOdometerSource ?? null,
      };
    }
  }

  const hasObservation = anchor?.anchorKm != null;

  return {
    telemetryKm,
    telemetryAttribute,
    anchor,
    hasObservation,
    latestObservationKm: anchor?.anchorKm ?? null,
    device,
    position,
  };
}

/**
 * Synchronous evidence builder for callers that already hold batch-loaded
 * device/position/spec rows (e.g. the fleet list, which loads all three via
 * single IN-clause queries for the whole company). Produces the same
 * evidence shape as collectEvidence() but with zero additional I/O, so it
 * must feed the same resolveOdometerFromEvidence() core rather than a
 * second engine. Full odometer→totalDistance→mileage priority is preserved
 * by reading raw position attributes directly (not a pre-normalised
 * telemetry object that only carries totalDistance).
 * @param {{
 *   deviceStatus: string|null,
 *   deviceLastUpdate: string|Date|null,
 *   positionFixTime: string|Date|null,
 *   positionAttributes: Record<string, unknown>|null,
 *   verifiedOdometerKm: number|null,
 *   verifiedOdometerAt: string|Date|null,
 *   verifiedOdometerSource: string|null,
 *   verifiedTraccarDistance: number|null,
 * }}
 */
export function buildEvidenceFromBatch({
  deviceStatus = null,
  deviceLastUpdate = null,
  positionFixTime = null,
  positionAttributes = null,
  verifiedOdometerKm = null,
  verifiedOdometerAt = null,
  verifiedOdometerSource = null,
  verifiedTraccarDistance = null,
}) {
  let telemetryKm = null;
  let telemetryAttribute = null;
  const extracted = extractTelemetryEvidence(positionAttributes);
  if (extracted.km != null) {
    telemetryKm = extracted.km;
    telemetryAttribute = extracted.attribute;
  }

  let anchor = null;
  if (verifiedOdometerKm != null) {
    anchor = {
      anchorKm: Number(verifiedOdometerKm),
      anchorTelemetryKm: legacyAnchorTelemetryToKm(verifiedTraccarDistance),
      anchoredAt: verifiedOdometerAt ?? null,
      anchorSource: verifiedOdometerSource ?? null,
    };
  }

  const hasObservation = anchor?.anchorKm != null;

  return {
    telemetryKm,
    telemetryAttribute,
    anchor,
    hasObservation,
    latestObservationKm: anchor?.anchorKm ?? null,
    device: { status: deviceStatus, lastUpdate: deviceLastUpdate },
    position: { fixTime: positionFixTime },
  };
}
