import { OperationSessionRefuel } from '../models/index.js';

export async function bulkCreate(records, options = {}) {
  return OperationSessionRefuel.bulkCreate(records, options);
}

export async function listBySessionId(sessionId, options = {}) {
  return OperationSessionRefuel.findAll({
    where: { sessionId: Number(sessionId) },
    order: [['sessionDate', 'DESC'], ['id', 'DESC']],
    ...options,
  });
}

export async function findById(refuelId, options = {}) {
  return OperationSessionRefuel.findByPk(refuelId, options);
}

export async function findBySessionAndId(sessionId, refuelId, options = {}) {
  return OperationSessionRefuel.findOne({
    where: {
      id: Number(refuelId),
      sessionId: Number(sessionId),
    },
    ...options,
  });
}

export async function findLatestByVehicleId(vehicleId, options = {}) {
  return OperationSessionRefuel.findOne({
    where: { vehicleId: Number(vehicleId) },
    order: [['sessionDate', 'DESC'], ['id', 'DESC']],
    ...options,
  });
}

export async function updateManyBySessionId(sessionId, values, options = {}) {
  return OperationSessionRefuel.update(values, {
    where: { sessionId: Number(sessionId) },
    ...options,
  });
}
