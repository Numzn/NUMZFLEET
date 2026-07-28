import fs from 'fs';
import { resolveStoredProfilePath } from '../../middleware/profileUpload.js';
import * as svc from './profileService.js';

export const getMe = async (req, res) => {
  try {
    const data = await svc.getMe(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to load profile' });
  }
};

export const patchMe = async (req, res) => {
  try {
    const data = await svc.patchMe(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to update profile' });
  }
};

export const patchPassword = async (req, res) => {
  try {
    const data = await svc.changePassword(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to change password' });
  }
};

export const getLoginHistory = async (req, res) => {
  try {
    const data = await svc.getLoginHistory(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to load login history' });
  }
};

export const postAvatar = async (req, res) => {
  try {
    const data = await svc.patchAvatar(req);
    res.json(data);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Failed to upload avatar' });
  }
};

export const getAvatar = async (req, res) => {
  try {
    const filePath = resolveStoredProfilePath(req.params.fileId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Avatar not found' });
    }
    return res.sendFile(filePath);
  } catch (e) {
    const status = e.statusCode || 400;
    return res.status(status).json({ error: e.message || 'Invalid avatar' });
  }
};
