import { OperationSession } from '../models/index.js';

export async function listByUser(user) {
  const where = user?.administrator ? {} : { userId: user.id };
  return OperationSession.findAll({
    where,
    order: [['sessionDate', 'DESC'], ['id', 'DESC']],
  });
}

export async function findById(sessionId, options = {}) {
  return OperationSession.findByPk(sessionId, options);
}

export async function findActiveByUserId(userId, options = {}) {
  return OperationSession.findOne({
    where: {
      userId: Number(userId),
      status: 'active',
    },
    ...options,
  });
}

export async function create(values, options = {}) {
  return OperationSession.create(values, options);
}

export async function updateByInstance(instance, values, options = {}) {
  return instance.update(values, options);
}
