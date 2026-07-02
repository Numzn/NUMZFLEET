import { Op } from 'sequelize';
import { OperationSession, OperationSessionRefuel, OperationSessionInvoice } from '../models/index.js';
import { listByUser } from '../repositories/operationSessionRepository.js';
import { summarizeInvoices } from './invoiceReconciliationService.js';
import { resolveOdometerMapForDevices } from './operationSessionCore.js';

function pctAccuracy(forecast, actual) {
  const f = Number(forecast);
  const a = Number(actual);
  if (!Number.isFinite(f) || f <= 0 || !Number.isFinite(a)) return null;
  const variance = Math.abs(a - f) / f;
  return Number(Math.max(0, (1 - variance) * 100).toFixed(1));
}

export async function getDailyOperationKpis(user, query = {}, companyId = null) {
  const sessions = await listByUser(user, companyId);
  let filtered = sessions;

  if (query.calendarDate) {
    filtered = sessions.filter((s) => String(s.calendarDate) === String(query.calendarDate));
  } else if (query.from || query.to) {
    filtered = sessions.filter((s) => {
      const d = String(s.calendarDate);
      if (query.from && d < String(query.from)) return false;
      if (query.to && d > String(query.to)) return false;
      return true;
    });
  }

  const invoicesByOperation = new Map();
  if (filtered.length > 0) {
    const invoices = await OperationSessionInvoice.findAll({
      where: { operationId: { [Op.in]: filtered.map((s) => s.id) } },
    });
    for (const inv of invoices) {
      const list = invoicesByOperation.get(inv.operationId) || [];
      list.push(inv);
      invoicesByOperation.set(inv.operationId, list);
    }
  }

  return filtered.map((s) => {
    const forecast = s.approvedLitres != null ? Number(s.approvedLitres) : Number(s.totalEstimatedFuel || 0);
    const actual = Number(s.totalActualFuel || 0);
    const budget = s.approvedBudget != null ? Number(s.approvedBudget) : Number(s.totalEstimatedCost || 0);
    const actualCost = Number(s.totalActualCost || 0);
    const opInvoices = invoicesByOperation.get(s.id) || [];
    const invoiceSummary = summarizeInvoices(opInvoices, {
      sessionActualLitres: actual,
      sessionActualCost: actualCost,
    });
    return {
      operationId: s.id,
      reference: s.reference || null,
      calendarDate: s.calendarDate,
      status: s.status,
      stationName: s.stationName || null,
      forecastLitres: forecast,
      actualLitres: actual,
      varianceLitres: Number((actual - forecast).toFixed(2)),
      forecastAccuracyPercent: pctAccuracy(forecast, actual),
      approvedBudget: budget,
      actualCost,
      budgetAccuracyPercent: pctAccuracy(budget, actualCost),
      invoiceStatus: opInvoices.length > 0 ? invoiceSummary.status : null,
      invoiceCount: opInvoices.length,
    };
  });
}

export async function getVehicleOperationKpis(user, query = {}, companyId = null) {
  const vehicleId = Number(query.vehicleId);
  if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
    const error = new Error('vehicleId query parameter is required');
    error.statusCode = 400;
    throw error;
  }

  const sessionWhere = {};
  if (companyId) sessionWhere.companyId = companyId;
  if (!user?.administrator && !user?.isManager) {
    sessionWhere.userId = user.id;
  }
  const refuels = await OperationSessionRefuel.findAll({
    where: {
      vehicleId,
      actualFuelLitres: { [Op.gt]: 0 },
    },
    include: [{
      model: OperationSession,
      as: 'session',
      where: sessionWhere,
      required: true,
    }],
    order: [['sessionDate', 'DESC']],
    limit: Math.min(Number(query.limit) || 50, 200),
  });

  const odometerMap = await resolveOdometerMapForDevices(refuels.map((r) => r.vehicleId));

  const rows = refuels.map((r) => {
    const planned = r.plannedFuelLitres != null ? Number(r.plannedFuelLitres) : Number(r.estimatedFuelLitres || 0);
    const actual = Number(r.actualFuelLitres);
    const liveOdometer = odometerMap.get(Number(r.vehicleId));
    return {
      refuelId: r.id,
      operationId: r.sessionId,
      calendarDate: r.session?.calendarDate,
      plannedLitres: planned,
      actualLitres: actual,
      varianceLitres: Number((actual - planned).toFixed(2)),
      forecastAccuracyPercent: pctAccuracy(planned, actual),
      mileage: liveOdometer?.odometerKm ?? null,
      odometerKm: liveOdometer?.odometerKm ?? null,
      sessionDate: r.sessionDate,
    };
  });

  const accuracies = rows.map((r) => r.forecastAccuracyPercent).filter((n) => n != null);
  const avgAccuracy = accuracies.length
    ? Number((accuracies.reduce((s, v) => s + v, 0) / accuracies.length).toFixed(1))
    : null;

  return {
    vehicleId,
    refillCount: rows.length,
    averageForecastAccuracyPercent: avgAccuracy,
    refuels: rows,
  };
}

export async function getManagementOperationKpis(user, query = {}) {
  const sessions = await listByUser(user);
  const month = query.month ? String(query.month) : null;

  const filtered = month
    ? sessions.filter((s) => String(s.calendarDate).startsWith(month))
    : sessions;

  let totalForecast = 0;
  let totalActual = 0;
  let totalBudget = 0;
  let totalCost = 0;
  let approvedCount = 0;

  for (const s of filtered) {
    const forecast = s.approvedLitres != null ? Number(s.approvedLitres) : Number(s.totalEstimatedFuel || 0);
    const actual = Number(s.totalActualFuel || 0);
    const budget = s.approvedBudget != null ? Number(s.approvedBudget) : Number(s.totalEstimatedCost || 0);
    const cost = Number(s.totalActualCost || 0);
    totalForecast += forecast;
    totalActual += actual;
    totalBudget += budget;
    totalCost += cost;
    if (s.status === 'approved' || s.status === 'locked') approvedCount += 1;
  }

  return {
    month: month || 'all',
    operationCount: filtered.length,
    approvedOperationCount: approvedCount,
    totalForecastLitres: Number(totalForecast.toFixed(2)),
    totalActualLitres: Number(totalActual.toFixed(2)),
    totalVarianceLitres: Number((totalActual - totalForecast).toFixed(2)),
    forecastAccuracyPercent: pctAccuracy(totalForecast, totalActual),
    totalApprovedBudget: Number(totalBudget.toFixed(2)),
    totalActualCost: Number(totalCost.toFixed(2)),
    budgetAccuracyPercent: pctAccuracy(totalBudget, totalCost),
  };
}
