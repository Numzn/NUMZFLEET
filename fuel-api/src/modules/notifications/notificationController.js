import * as svc from './notificationService.js';

export const listNotifications = async (req, res) => {
  try {
    const data = await svc.listForRequestUser(req);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list notifications' });
  }
};

export const patchRead = async (req, res) => {
  try {
    const row = await svc.markRead(req);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update' });
  }
};

export const patchReadAll = async (req, res) => {
  try {
    const data = await svc.markAllRead(req);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update' });
  }
};

export const removeOne = async (req, res) => {
  try {
    const ok = await svc.archive(req);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete' });
  }
};

export const patchLifecycle = async (req, res) => {
  try {
    const row = await svc.patchLifecycle(req);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update lifecycle' });
  }
};
