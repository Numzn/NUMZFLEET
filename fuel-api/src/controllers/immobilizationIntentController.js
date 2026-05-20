import {
  createIntent,
  cancelIntent,
  getActiveIntent,
  getIntentHistory,
  getCapabilitiesForDevice,
} from '../services/immobilizationIntentService.js';
import { isTraccarCommandApiConfigured } from '../services/traccarCommandService.js';
import { DeviceAssignment } from '../models/index.js';
import { dbErrorMessage } from '../utils/dbErrorMessage.js';

async function resolveDeviceIdForVehicle(vehicleId) {
  const assignment = await DeviceAssignment.findOne({
    where: { vehicleId, isActive: true, unassignedAt: null },
  });
  return assignment ? Number(assignment.deviceId) : null;
}

export const getCapabilities = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const deviceId = await resolveDeviceIdForVehicle(vehicleId);
    if (deviceId == null) {
      return res.json({
        commandApiConfigured: isTraccarCommandApiConfigured(),
        canImmobilize: false,
        canMobilize: false,
        types: [],
        blockedReason: 'no_device_assignment',
      });
    }
    const caps = await getCapabilitiesForDevice(deviceId);
    return res.json({ deviceId, ...caps });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Immobilization capabilities error:', error);
    return res.status(status).json({
      error: dbErrorMessage(error, 'Failed to load immobilization capabilities'),
    });
  }
};

export const getActive = async (req, res) => {
  try {
    const intent = await getActiveIntent(req.params.vehicleId);
    return res.json({ intent });
  } catch (error) {
    console.error('Get active immobilization intent error:', error);
    return res.status(500).json({
      error: dbErrorMessage(error, 'Failed to load active intent'),
    });
  }
};

export const listHistory = async (req, res) => {
  try {
    const limit = req.query.limit != null ? parseInt(req.query.limit, 10) : 20;
    const intents = await getIntentHistory(req.params.vehicleId, limit);
    return res.json({ intents });
  } catch (error) {
    console.error('List immobilization intents error:', error);
    return res.status(500).json({
      error: dbErrorMessage(error, 'Failed to load intent history'),
    });
  }
};

export const create = async (req, res) => {
  try {
    const { action } = req.body || {};
    if (action !== 'immobilize' && action !== 'mobilize') {
      return res.status(400).json({ error: 'action must be immobilize or mobilize' });
    }
    const intent = await createIntent(req.params.vehicleId, action, req.user);
    return res.status(201).json({ intent });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Create immobilization intent error:', error);
    const body = { error: dbErrorMessage(error, 'Failed to create intent') };
    if (error.existingIntent) body.existingIntent = error.existingIntent;
    if (error.code) body.code = error.code;
    return res.status(status).json(body);
  }
};

export const cancel = async (req, res) => {
  try {
    const intent = await cancelIntent(req.params.intentId, req.user);
    if (intent.vehicleId !== req.params.vehicleId) {
      return res.status(404).json({ error: 'Intent not found for this vehicle' });
    }
    return res.json({ intent });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Cancel immobilization intent error:', error);
    return res.status(status).json({
      error: dbErrorMessage(error, 'Failed to cancel intent'),
    });
  }
};
