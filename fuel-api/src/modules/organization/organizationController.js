import * as svc from './organizationService.js';

export const getOrganization = async (req, res) => {
  try {
    const data = await svc.getOrganization(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to load organization' });
  }
};

export const patchOrganization = async (req, res) => {
  try {
    const data = await svc.patchOrganization(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to update organization' });
  }
};
