import * as svc from './pushSubscriptionsService.js';

export const getPublicKey = async (req, res) => {
  try {
    const data = await svc.getPublicKey();
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to load VAPID public key' });
  }
};

export const getStatus = async (req, res) => {
  try {
    const data = await svc.getStatus(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to check push subscription status' });
  }
};

export const subscribe = async (req, res) => {
  try {
    const data = await svc.subscribe(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to save push subscription' });
  }
};

export const unsubscribe = async (req, res) => {
  try {
    const data = await svc.unsubscribe(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to remove push subscription' });
  }
};
