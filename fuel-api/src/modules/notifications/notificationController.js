import * as svc from './notificationService.js';
import { getDeliveryQueueStats } from '../../notifications/delivery/deliveryRepository.js';
import { getDeliveryWorkerStatus } from '../../notifications/delivery/deliveryWorkerStatus.js';

export const syncNotifications = async (req, res) => {
  try {
    const data = await svc.syncForRequestUser(req);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to sync notifications' });
  }
};

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

export const postEscalate = async (req, res) => {
  try {
    const data = await svc.escalateVehicleAlert(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to escalate alert' });
  }
};

/**
 * Operational view of notification delivery for this company: worker health
 * (in-memory) plus queue depth (database). Tenant-scoped via req.auth like
 * every other read in this module — an operator sees their own backlog only.
 */
export const getDeliveryStats = async (req, res) => {
  try {
    const stats = await getDeliveryQueueStats(req.auth.companyId);
    res.json({ worker: getDeliveryWorkerStatus(), queue: stats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load delivery stats' });
  }
};
