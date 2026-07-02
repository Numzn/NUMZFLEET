import { getVehicleMerged } from '../services/vehicleFleetService.js';
import { applyObservation } from '../vehicleEngine/odometer/applyObservation.js';
import { resolveVehicleOdometer } from '../vehicleEngine/odometer/resolveVehicleOdometer.js';
import { formatOdometerResponse } from '../vehicleEngine/odometer/formatOdometerResponse.js';
import { dbErrorMessage } from '../utils/dbErrorMessage.js';

/**
 * POST /api/vehicles/:id/odometer/observation — record dashboard confirmation (M1 Observation).
 */
export async function postOdometerObservation(req, res) {
  try {
    const merged = await getVehicleMerged(req.params.id, req.auth?.companyId);
    if (!merged) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const deviceId = merged.assignment?.deviceId;
    if (deviceId == null) {
      return res.status(400).json({ error: 'Assign a tracker before recording an odometer observation' });
    }

    const { odometerKm, source } = req.body || {};
    if (odometerKm == null || odometerKm === '') {
      return res.status(400).json({ error: 'odometerKm is required' });
    }

    await applyObservation(deviceId, odometerKm, source || 'manual');

    const odometerState = await resolveVehicleOdometer({ merged, deviceId: Number(deviceId) });
    return res.json(formatOdometerResponse(odometerState));
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('[vehicle/odometer/observation]', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to record odometer observation') });
  }
}

/**
 * GET /api/vehicles/:id/odometer — current resolved odometer (replaces device-scoped spec route).
 */
export async function getVehicleOdometer(req, res) {
  try {
    const merged = await getVehicleMerged(req.params.id, req.auth?.companyId);
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
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to get vehicle odometer') });
  }
}
