import { getVehicleMerged } from '../services/vehicleFleetService.js';
import { recordObservation, odometerErrorBody } from '../vehicleEngine/odometer/vehicleOdometerAnchorService.js';
import { resolveVehicleOdometer } from '../vehicleEngine/odometer/resolveVehicleOdometer.js';
import { formatOdometerResponse } from '../vehicleEngine/odometer/formatOdometerResponse.js';

const SOURCES = new Set(['manual', 'audit', 'service', 'onboarding']);

/** Only the supporting evidence we know how to keep: a short note and an attachment reference. */
function sanitizeEvidence(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  if (typeof raw.note === 'string' && raw.note.trim()) out.note = raw.note.trim().slice(0, 500);
  if (typeof raw.attachmentId === 'string' && raw.attachmentId.trim()) out.attachmentId = raw.attachmentId.trim().slice(0, 64);
  return out;
}

/**
 * POST /api/vehicles/:id/odometer/observation -- record a reading of the vehicle's odometer.
 *
 * Body: { odometerKm, source?, confirmedPhysical?, reason?, evidence?: { note?, attachmentId? }, observedAt? }
 *
 * `confirmedPhysical: true` is the person's attestation that the value was read from the vehicle's
 * dashboard; it is the only way to make a reading "physically verified". Without it the reading can still be
 * recorded when it agrees with the system's own figure, but it is never labelled physical. A reading that
 * fails the plausibility rules is a 422 with a stable `code` and changes nothing.
 */
export async function postOdometerObservation(req, res) {
  try {
    const merged = await getVehicleMerged(req.params.id, req.auth);
    if (!merged) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const body = req.body || {};
    if (body.odometerKm == null || body.odometerKm === '') {
      return res.status(400).json({ error: 'odometerKm is required' });
    }

    let observedAt = null;
    if (body.observedAt != null && body.observedAt !== '') {
      observedAt = new Date(body.observedAt);
      if (Number.isNaN(observedAt.getTime()) || observedAt.getTime() > Date.now() + 5 * 60 * 1000) {
        return res.status(400).json({ error: 'observedAt must be a valid time that is not in the future' });
      }
    }

    const anchor = await recordObservation({
      vehicleId: merged.id,
      odometerKm: Number(body.odometerKm),
      source: SOURCES.has(body.source) ? body.source : 'manual',
      confirmedPhysical: body.confirmedPhysical === true,
      reason: typeof body.reason === 'string' ? body.reason.trim() || null : null,
      evidence: sanitizeEvidence(body.evidence),
      observedAt,
      actorUserId: req.auth?.userId ?? req.user?.id ?? null,
    });

    const refreshed = await getVehicleMerged(req.params.id, req.auth);
    const odometerState = await resolveVehicleOdometer({
      merged: refreshed,
      deviceId: refreshed?.assignment?.deviceId != null ? Number(refreshed.assignment.deviceId) : null,
    });
    return res.json({
      ...formatOdometerResponse(odometerState),
      observation: { id: anchor.id, kind: anchor.kind, state: anchor.state, recorded: anchor.createdAt != null },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('[vehicle/odometer/observation]', error);
    return res.status(status).json(odometerErrorBody(error, 'Failed to record odometer observation'));
  }
}

/**
 * GET /api/vehicles/:id/odometer -- current resolved odometer (replaces device-scoped spec route).
 */
export async function getVehicleOdometer(req, res) {
  try {
    const merged = await getVehicleMerged(req.params.id, req.auth);
    if (!merged) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const deviceId = merged.assignment?.deviceId ?? null;
    const odometerState = await resolveVehicleOdometer({ merged, deviceId });
    return res.json({
      ...formatOdometerResponse(odometerState),
      resolutionMode: odometerState.resolutionMode,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('[vehicle/odometer]', error);
    return res.status(status).json(odometerErrorBody(error, 'Failed to get vehicle odometer'));
  }
}
