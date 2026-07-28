import * as svc from './notificationPreferencesService.js';

export const getPreferences = async (req, res) => {
  try {
    const data = await svc.getPreferences(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to load notification preferences' });
  }
};

export const putPreferences = async (req, res) => {
  try {
    const data = await svc.putPreferences(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to update notification preferences' });
  }
};
