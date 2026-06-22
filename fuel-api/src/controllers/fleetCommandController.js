import { getFleetCommandCenterKpis } from '../services/fleetCommandCenterService.js';

export async function getFleetCommandCenter(req, res) {
  try {
    const data = await getFleetCommandCenterKpis(req.auth?.companyId);
    return res.json(data);
  } catch (error) {
    console.error('[fleet-command-center]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load fleet command center data' });
  }
}
