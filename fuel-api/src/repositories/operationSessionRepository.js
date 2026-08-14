import { OperationSession } from '../models/index.js';
import { Op } from 'sequelize';

export async function listByUser(user, companyId) {
  const where = {};
  
  // Handle both single companyId (backward compat) and array (Partner scope)
  if (companyId) {
    if (Array.isArray(companyId)) {
      if (companyId.length > 0) {
        where.companyId = { [Op.in]: companyId };
      } else {
        // Empty array = no accessible companies, return empty
        return [];
      }
    } else if (companyId !== null) {
      where.companyId = companyId;
    }
  }
  
  if (!user?.administrator && !user?.isManager) {
    where.userId = user.id;
  }
  return OperationSession.findAll({
    where,
    order: [['calendarDate', 'DESC'], ['id', 'DESC']],
  });
}
export async function findById(sessionId, options = {}) {
  return OperationSession.findByPk(sessionId, options);
}

export async function findByIdScoped(sessionId, companyId, options = {}) {
  const where = { id: sessionId };
  if (companyId) where.companyId = companyId;
  return OperationSession.findOne({ where, ...options });
}

export async function findByUserIdAndCalendarDate(userId, calendarDate, options = {}) {
  return OperationSession.findOne({
    where: {
      userId: Number(userId),
      calendarDate,
    },
    ...options,
  });
}

/** Count of Fuel Days for a fleet on a calendar date, used to sequence references. */
export async function countByCompanyAndCalendarDate(companyId, calendarDate, options = {}) {
  return OperationSession.count({
    where: {
      companyId: companyId ?? null,
      calendarDate,
    },
    ...options,
  });
}

/** @deprecated use findByUserIdAndCalendarDate for operational days */
export async function findActiveByUserId(userId, options = {}) {
  return OperationSession.findOne({
    where: {
      userId: Number(userId),
      status: 'draft',
    },
    order: [['calendarDate', 'DESC']],
    ...options,
  });
}

export async function create(values, options = {}) {
  return OperationSession.create(values, options);
}

export async function updateByInstance(instance, values, options = {}) {
  return instance.update(values, options);
}
