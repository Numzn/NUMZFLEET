import { getFleetCommandCenterKpis } from '../services/fleetCommandCenterService.js';
import { getFleetDeviceSnapshot } from '../services/fleetDeviceSnapshotService.js';
import { createCompanyDevice } from '../services/deviceProvisioningService.js';
import { dbErrorMessage } from '../utils/dbErrorMessage.js';

export async function getFleetCommandCenter(req, res) {
  try {
    const data = await getFleetCommandCenterKpis(req.auth?.companyId);
    return res.json(data);
  } catch (error) {
    console.error('[fleet-command-center]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load fleet command center data' });
  }
}

/**
 * GET /api/fleet/devices — company-scoped device + position snapshot for the
 * Dashboard and Live Map (Vehicle Visibility Audit, D2).
 */
export async function getFleetDeviceSnapshotHandler(req, res) {
  try {
    const data = await getFleetDeviceSnapshot(req.auth);
    return res.json(data);
  } catch (error) {
    console.error('[fleet-devices]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load fleet device snapshot' });
  }
}

/**
 * POST /api/fleet/devices — create a Traccar device under the caller's own
 * company and register NUMZFLEET ownership for it immediately (no vehicle
 * required yet). Replaces the frontend's previous direct
 * POST {traccarPath}/api/devices call, which bypassed fuel-api and left the
 * new device with no company_devices row until someone happened to assign
 * it to a vehicle.
 */
export async function createFleetDeviceHandler(req, res) {
  try {
    const device = await createCompanyDevice(req.auth?.companyId, req.body || {});
    return res.status(201).json(device);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('[fleet-devices] create failed:', error?.message || error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to create device') });
  }
}
