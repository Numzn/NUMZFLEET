import sequelize from '../config/database.js';
import {
  findById as findSessionById,
} from '../repositories/operationSessionRepository.js';
import { listBySessionId } from '../repositories/operationSessionRefuelRepository.js';
import { getErbPriceMap } from './fuelPriceService.js';
import { recordAuditEvent, AUDIT_EVENT_TYPES } from './auditEventService.js';
import {
  assertCanAccessSession,
  refreshSessionTotals,
  toSessionDto,
} from './operationSessionCore.js';
import { assertOperationWritable, maybePersistLock } from './operationLockHelper.js';
import { notifyOperationApproved } from './operationNotificationService.js';

export async function approveOperation(user, sessionId, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  await maybePersistLock(session);
  await assertOperationWritable(session, 'Cannot approve a locked operation');

  if (session.status !== 'draft') {
    const error = new Error('Only draft operations can be approved');
    error.statusCode = 400;
    throw error;
  }

  const dto = await sequelize.transaction(async (transaction) => {
    await refreshSessionTotals(session.id, transaction);
    const refuels = await listBySessionId(session.id, { transaction });

    if (!refuels.length) {
      const error = new Error('Add at least one vehicle before approving');
      error.statusCode = 400;
      throw error;
    }

    const { prices, priceFor } = await getErbPriceMap(['diesel', 'petrol']);

    const plannedFor = (r) => {
      const p = r.plannedFuelLitres != null ? Number(r.plannedFuelLitres) : Number(r.estimatedFuelLitres || 0);
      return Number.isFinite(p) ? p : 0;
    };

    const approvedLitres = refuels.reduce((sum, r) => sum + plannedFor(r), 0);
    const approvedBudget = Number(refuels.reduce((sum, r) => {
      const price = priceFor(r.fuelTypeSnapshot) ?? 0;
      return sum + plannedFor(r) * price;
    }, 0).toFixed(2));

    const dieselPrice = prices.diesel ?? null;
    const petrolPrice = prices.petrol ?? null;
    const now = new Date();

    await session.update({
      status: 'approved',
      approvedBy: user.id,
      approvedAt: now,
      approvedFuelPrice: dieselPrice,
      approvedDieselPrice: dieselPrice,
      approvedPetrolPrice: petrolPrice,
      approvedBudget,
      approvedLitres: Number(approvedLitres.toFixed(2)),
    }, { transaction });

    await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.FORECAST_APPROVED, user.id, {
      approvedLitres,
      approvedBudget,
      approvedDieselPrice: dieselPrice,
      approvedPetrolPrice: petrolPrice,
    }, { transaction });

    const fresh = await findSessionById(session.id, { transaction });
    return toSessionDto(fresh);
  });

  await notifyOperationApproved(session, user.id);
  return dto;
}
