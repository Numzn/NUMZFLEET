import { Op } from 'sequelize';
import { ServiceRecord, MaintenanceBudget, Vehicle } from '../models/index.js';
import { DEFAULT_COMPANY_ID } from '../models/index.js';

function sumField(rows, field) {
  return rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
}

function resolveCostAmount(row) {
  const actual = Number(row.actualCost);
  if (Number.isFinite(actual) && actual > 0) return actual;
  const legacy = Number(row.cost);
  if (Number.isFinite(legacy) && legacy > 0) return legacy;
  return 0;
}

function breakdownForRow(row) {
  const total = resolveCostAmount(row);
  const labour = Number(row.labourCost) || 0;
  const parts = Number(row.partsCost) || 0;
  const other = Number(row.otherCost) || 0;
  const splitSum = labour + parts + other;
  if (splitSum > 0) {
    return { labour, parts, other, total: splitSum };
  }
  if (total > 0) {
    return { labour: total * 0.24, parts: total * 0.58, other: total * 0.18, total };
  }
  return { labour: 0, parts: 0, other: 0, total: 0 };
}

export async function getMaintenanceBudget(companyId) {
  const row = await MaintenanceBudget.findByPk(String(companyId));
  if (row) {
    return {
      monthlyBudget: Number(row.monthlyBudget) || 0,
      currency: row.currency || 'ZMW',
    };
  }
  return { monthlyBudget: 0, currency: 'ZMW' };
}

export async function upsertMaintenanceBudget(companyId, { monthlyBudget, currency }) {
  const [row] = await MaintenanceBudget.upsert({
    companyId: String(companyId),
    monthlyBudget: Number(monthlyBudget) || 0,
    currency: currency || 'ZMW',
    updatedAt: new Date(),
  });
  return {
    monthlyBudget: Number(row.monthlyBudget) || 0,
    currency: row.currency || 'ZMW',
  };
}

async function completedInRange(companyId, from, to, fleetVehicleId) {
  const where = {
    companyId: String(companyId),
    status: 'completed',
    completedAt: {
      [Op.gte]: from,
      [Op.lte]: to,
    },
  };
  if (fleetVehicleId) {
    where.fleetVehicleId = String(fleetVehicleId);
  }
  return ServiceRecord.findAll({
    where,
    include: [{
      model: Vehicle,
      as: 'vehicle',
      attributes: ['id', 'name', 'plateNumber'],
      required: false,
    }],
  });
}

export async function aggregateMaintenanceCosts(companyId, { from, to, fleetVehicleId } = {}) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getFullYear(), end.getMonth(), 1);

  const monthStart = new Date(end.getFullYear(), end.getMonth(), 1);
  const monthEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0, 23, 59, 59, 999);
  const prevMonthStart = new Date(end.getFullYear(), end.getMonth() - 1, 1);
  const prevMonthEnd = new Date(end.getFullYear(), end.getMonth(), 0, 23, 59, 59, 999);

  const [rangeRows, monthRows, prevMonthRows, budget] = await Promise.all([
    completedInRange(companyId, start, end, fleetVehicleId),
    completedInRange(companyId, monthStart, monthEnd, fleetVehicleId),
    completedInRange(companyId, prevMonthStart, prevMonthEnd, fleetVehicleId),
    getMaintenanceBudget(companyId),
  ]);

  const monthTotal = monthRows.reduce((s, r) => s + resolveCostAmount(r), 0);
  const prevMonthTotal = prevMonthRows.reduce((s, r) => s + resolveCostAmount(r), 0);
  const monthTrendPct = prevMonthTotal > 0
    ? Math.round(((monthTotal - prevMonthTotal) / prevMonthTotal) * 100)
    : (monthTotal > 0 ? 100 : 0);

  let labour = 0;
  let parts = 0;
  let other = 0;
  for (const row of monthRows) {
    const b = breakdownForRow(row);
    labour += b.labour;
    parts += b.parts;
    other += b.other;
  }
  const breakdownTotal = labour + parts + other;
  const breakdown = breakdownTotal > 0
    ? {
      labour: Math.round((labour / breakdownTotal) * 100),
      parts: Math.round((parts / breakdownTotal) * 100),
      other: Math.round((other / breakdownTotal) * 100),
    }
    : { labour: 0, parts: 0, other: 0 };

  const byVehicle = new Map();
  for (const row of monthRows) {
    const vid = row.fleetVehicleId;
    if (!vid) continue;
    const amt = resolveCostAmount(row);
    const cur = byVehicle.get(vid) || {
      fleetVehicleId: vid,
      plate: row.vehicle?.plateNumber || null,
      name: row.vehicle?.name || null,
      total: 0,
    };
    cur.total += amt;
    byVehicle.set(vid, cur);
  }
  const topVehicles = [...byVehicle.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((v) => ({
      fleetVehicleId: v.fleetVehicleId,
      plate: v.plate,
      name: v.name,
      label: v.plate || v.name || v.fleetVehicleId,
      total: Math.round(v.total * 100) / 100,
    }));

  const dailyMap = new Map();
  for (const row of rangeRows) {
    if (!row.completedAt) continue;
    const key = new Date(row.completedAt).toISOString().slice(0, 10);
    dailyMap.set(key, (dailyMap.get(key) || 0) + resolveCostAmount(row));
  }
  const dailySeries = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total: Math.round(total * 100) / 100 }));

  const budgetRemaining = Math.max(0, budget.monthlyBudget - monthTotal);
  const budgetUsedPct = budget.monthlyBudget > 0
    ? Math.round((monthTotal / budget.monthlyBudget) * 100)
    : 0;

  return {
    currency: budget.currency,
    monthTotal: Math.round(monthTotal * 100) / 100,
    monthTrendPct,
    breakdown,
    breakdownAmounts: {
      labour: Math.round(labour * 100) / 100,
      parts: Math.round(parts * 100) / 100,
      other: Math.round(other * 100) / 100,
    },
    topVehicles,
    dailySeries,
    budget: {
      monthlyBudget: budget.monthlyBudget,
      remaining: Math.round(budgetRemaining * 100) / 100,
      usedPct: budgetUsedPct,
    },
  };
}

export { resolveCostAmount, breakdownForRow };
