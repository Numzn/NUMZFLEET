import { getFleetCommandCenterKpis } from '../services/fleetCommandCenterService.js';
import { getFleetDeviceSnapshot } from '../services/fleetDeviceSnapshotService.js';

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
