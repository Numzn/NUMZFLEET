import {
  listOperationSessions,
  createOperationSession,
  getOperationSessionDetails,
  createSessionRefuels,
  closeOperationSession,
} from '../services/operationSessionService.js';

export const listSessions = async (req, res) => {
  try {
    const rows = await listOperationSessions(req.user);
    return res.json(rows);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      console.error('List operation sessions error:', error);
    }
    return res.status(status).json({ error: error.message || 'Failed to list operation sessions' });
  }
};

export const createSession = async (req, res) => {
  try {
    const created = await createOperationSession(req.user, req.body || {});
    return res.status(201).json(created);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      console.error('Create operation session error:', error);
    }
    return res.status(status).json({ error: error.message || 'Failed to create operation session' });
  }
};

export const getSessionDetails = async (req, res) => {
  try {
    const session = await getOperationSessionDetails(req.user, req.params.id);
    return res.json(session);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      console.error('Get operation session details error:', error);
    }
    return res.status(status).json({ error: error.message || 'Failed to fetch operation session details' });
  }
};

export const closeSession = async (req, res) => {
  try {
    const session = await closeOperationSession(req.user, req.params.id);
    return res.json(session);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      console.error('Close operation session error:', error);
    }
    return res.status(status).json({ error: error.message || 'Failed to close operation session' });
  }
};

export const addRefuels = async (req, res) => {
  try {
    const result = await createSessionRefuels(req.user, req.params.id, req.body?.records);
    return res.status(201).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      console.error('Add operation session refuels error:', error);
    }
    return res.status(status).json({ error: error.message || 'Failed to add operation session refuels' });
  }
};
