import { Op } from 'sequelize';
import { OperationUnlock } from '../models/index.js';

export async function findActiveUnlockForOperation(operationId, now = new Date()) {
  return OperationUnlock.findOne({
    where: {
      operationId: Number(operationId),
      expiresAt: { [Op.gt]: now },
    },
    order: [['expiresAt', 'DESC']],
  });
}

export async function createUnlock(operationId, unlockedBy, expiresAt, reason) {
  return OperationUnlock.create({
    operationId: Number(operationId),
    unlockedBy: Number(unlockedBy),
    unlockedAt: new Date(),
    expiresAt,
    reason: reason || null,
  });
}
