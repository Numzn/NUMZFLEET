import { getVehicleEngine } from '../vehicleEngine/vehicleEngineService.js';
import { dbErrorMessage } from '../utils/dbErrorMessage.js';

export async function getEngine(req, res) {
  try {
    const data = await getVehicleEngine(req.params.id, req.auth?.companyId);
    return res.json(data);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('[vehicle/engine]', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to load vehicle engine') });
  }
}
