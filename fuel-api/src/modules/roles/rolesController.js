import * as svc from './rolesService.js';

export const listRoles = async (req, res) => {
  try {
    res.json(await svc.listRoles());
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to load roles' });
  }
};

export const listAssignments = async (req, res) => {
  try {
    res.json(await svc.listAssignments(req));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to load role assignments' });
  }
};

export const assignRole = async (req, res) => {
  try {
    res.json(await svc.assignRoleToUser(req));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to assign role' });
  }
};

export const removeRole = async (req, res) => {
  try {
    res.json(await svc.removeRoleFromUser(req));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to remove role' });
  }
};
