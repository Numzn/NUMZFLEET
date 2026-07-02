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

  if (position?.telemetry?.totalDistance != null) {
    const km = rawTelemetryToKm(position.telemetry.totalDistance, 'totalDistance');
    telemetryKm = km;
    telemetryAttribute = 'totalDistance';
  }

  if (telemetryKm == null && deviceId != null) {
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
