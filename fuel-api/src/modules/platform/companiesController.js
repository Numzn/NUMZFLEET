import * as svc from './companiesService.js';

export const listCompanies = async (req, res) => {
  try {
    res.json(await svc.listCompanies());
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to load companies' });
  }
};

export const provisionCompany = async (req, res) => {
  try {
    res.json(await svc.provisionCompany(req));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to provision company' });
  }
};
