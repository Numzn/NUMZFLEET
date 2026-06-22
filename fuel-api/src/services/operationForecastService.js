import sequelize from '../config/database.js';
import { OperationSessionRefuel } from '../models/index.js';
import {
  findById as findSessionById,
  updateByInstance as updateSessionByInstance,
} from '../repositories/operationSessionRepository.js';
import { listBySessionId } from '../repositories/operationSessionRefuelRepository.js';
import { getLatestErbPrice } from './fuelPriceService.js';
import { getVehicleFuelStatistics } from './vehicleFuelStatisticsService.js';
import { predictForVehicle } from '../intelligence/PredictionEngine.js';
import { recordAuditEvent, AUDIT_EVENT_TYPES } from './auditEventService.js';
import {
  assertCanAccessSession,
  refreshSessionTotals,
  toRefuelDto,
  toSessionDto,
} from './operationSessionCore.js';
import { assertOperationWritable, maybePersistLock } from './operationLockHelper.js';

async function buildForecastForSession(session) {
  const refuels = await listBySessionId(session.id);
  const priceInfo = await getLatestErbPrice('diesel');

  const vehicles = await Promise.all(
    refuels.map(async (refuel) => {
      const prediction = await predictForVehicle(refuel.vehicleId, getVehicleFuelStatistics);
      return {
        refuelId: refuel.id,
        vehicleId: refuel.vehicleId,
        plannedFuelLitres: refuel.plannedFuelLitres != null ? Number(refuel.plannedFuelLitres) : null,
        ...prediction,
      };
    }),
  );

  const totalPredictedLitres = vehicles.reduce(
    (sum, v) => sum + (Number(v.predictedLitres) || 0),
    0,
  );
  const pricePerLitre = priceInfo.pricePerLitre ?? 0;
  const estimatedCost = Number((totalPredictedLitres * pricePerLitre).toFixed(2));

  return {
    operation: await toSessionDto(session),
    erbPricePerLitre: pricePerLitre,
    fleetSummary: {
      totalPredictedLitres: Number(totalPredictedLitres.toFixed(2)),
      estimatedCost,
      vehicleCount: vehicles.length,
    },
    vehicles,
  };
}

export async function getOperationForecast(user, sessionId) {
  const session = await findSessionById(sessionId, {
    include: [{ model: OperationSessionRefuel, as: 'refuels' }],
  });
  assertCanAccessSession(session, user);
  await maybePersistLock(session);

  const forecast = await buildForecastForSession(session);
  await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.FORECAST_GENERATED, user.id, {
    vehicleCount: forecast.vehicles.length,
  });
  return forecast;
}

export async function regenerateOperationForecast(user, sessionId) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user);
  await maybePersistLock(session);
  await assertOperationWritable(session, 'Cannot regenerate forecast on a locked operation');

  if (session.status !== 'draft') {
    const error = new Error('Forecast can only be regenerated in draft status');
    error.statusCode = 400;
    throw error;
  }

  return sequelize.transaction(async (transaction) => {
    const refuels = await listBySessionId(session.id, { transaction });
    for (const refuel of refuels) {
      const prediction = await predictForVehicle(refuel.vehicleId, getVehicleFuelStatistics);
      if (prediction.predictedLitres != null) {
        await refuel.update({ plannedFuelLitres: prediction.predictedLitres }, { transaction });
      }
    }
    await refreshSessionTotals(session.id, transaction);
    const fresh = await findSessionById(session.id, { transaction });
    const forecast = await buildForecastForSession(fresh);
    await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.FORECAST_GENERATED, user.id, {
      regenerated: true,
      vehicleCount: forecast.vehicles.length,
    }, { transaction });
    return forecast;
  });
}

export async function getVehicleFuelProfile(user, vehicleId) {
  const stats = await getVehicleFuelStatistics(vehicleId);
  const prediction = await predictForVehicle(vehicleId, getVehicleFuelStatistics);
  return { statistics: stats, ...prediction };
}
