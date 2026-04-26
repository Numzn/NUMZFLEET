import sequelize from '../config/database.js';
import { OperationSession, OperationSessionRefuel } from '../models/index.js';

const toSessionDto = (session) => ({
  id: session.id,
  userId: session.userId,
  name: session.name,
  sessionDate: session.sessionDate,
  status: session.status,
  notes: session.notes,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

const toRefuelDto = (record) => ({
  id: record.id,
  sessionId: record.sessionId,
  userId: record.userId,
  vehicleId: record.vehicleId,
  fuelCost: Number(record.fuelCost),
  fuelAmount: Number(record.fuelAmount),
  currentMileage: record.currentMileage != null ? Number(record.currentMileage) : null,
  attendant: record.attendant,
  pumpNumber: record.pumpNumber,
  sessionDate: record.sessionDate,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const assertCanAccessSession = (session, user) => {
  if (!session) {
    const error = new Error('Operation session not found');
    error.statusCode = 404;
    throw error;
  }

  if (!user?.administrator && Number(session.userId) !== Number(user?.id)) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }
};

const parsePositiveNumber = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    const error = new Error(`${field} must be a positive number`);
    error.statusCode = 400;
    throw error;
  }
  return number;
};

const parseOptionalNumber = (value, field) => {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(`${field} must be a valid number`);
    error.statusCode = 400;
    throw error;
  }
  return number;
};

export async function listOperationSessions(user) {
  const where = user?.administrator ? {} : { userId: user.id };
  const rows = await OperationSession.findAll({
    where,
    order: [['sessionDate', 'DESC'], ['id', 'DESC']],
  });

  return rows.map(toSessionDto);
}

export async function createOperationSession(user, payload = {}) {
  const sessionDate = payload.sessionDate ? new Date(payload.sessionDate) : new Date();
  if (Number.isNaN(sessionDate.getTime())) {
    const error = new Error('sessionDate must be a valid date');
    error.statusCode = 400;
    throw error;
  }

  const created = await OperationSession.create({
    userId: user.id,
    name: payload.name ? String(payload.name).trim() : null,
    notes: payload.notes ? String(payload.notes).trim() : null,
    status: payload.status === 'closed' ? 'closed' : 'active',
    sessionDate,
  });

  return toSessionDto(created);
}

export async function getOperationSessionDetails(user, sessionId) {
  const session = await OperationSession.findByPk(sessionId, {
    include: [{ model: OperationSessionRefuel, as: 'refuels' }],
    order: [[{ model: OperationSessionRefuel, as: 'refuels' }, 'sessionDate', 'DESC']],
  });

  assertCanAccessSession(session, user);

  return {
    ...toSessionDto(session),
    refuels: (session.refuels || []).map(toRefuelDto),
  };
}

export async function closeOperationSession(user, sessionId) {
  const session = await OperationSession.findByPk(sessionId);
  assertCanAccessSession(session, user);

  if (session.status === 'closed') {
    const error = new Error('Session is already closed');
    error.statusCode = 400;
    throw error;
  }

  await session.update({ status: 'closed' });
  return toSessionDto(session);
}

export async function createSessionRefuels(user, sessionId, records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    const error = new Error('records must be a non-empty array');
    error.statusCode = 400;
    throw error;
  }

  const session = await OperationSession.findByPk(sessionId);
  assertCanAccessSession(session, user);

  const sanitized = records.map((record) => {
    const vehicleId = Number(record?.vehicleId);
    if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
      const error = new Error('vehicleId must be a positive number');
      error.statusCode = 400;
      throw error;
    }

    const providedDate = record?.sessionDate ? new Date(record.sessionDate) : new Date();
    if (Number.isNaN(providedDate.getTime())) {
      const error = new Error('sessionDate must be a valid date');
      error.statusCode = 400;
      throw error;
    }

    return {
      sessionId: Number(sessionId),
      userId: user.id,
      vehicleId,
      fuelCost: parsePositiveNumber(record?.fuelCost, 'fuelCost'),
      fuelAmount: parsePositiveNumber(record?.fuelAmount, 'fuelAmount'),
      currentMileage: parseOptionalNumber(record?.currentMileage, 'currentMileage'),
      attendant: record?.attendant ? String(record.attendant).trim() : null,
      pumpNumber: record?.pumpNumber ? String(record.pumpNumber).trim() : null,
      sessionDate: providedDate,
    };
  });

  const created = await sequelize.transaction(async (transaction) => OperationSessionRefuel.bulkCreate(
    sanitized,
    { transaction, returning: true },
  ));

  return {
    sessionId: Number(sessionId),
    createdCount: created.length,
    records: created.map(toRefuelDto),
  };
}
