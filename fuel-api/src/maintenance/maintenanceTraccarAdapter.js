import traccar, { getTraccarLatestPositionsByDeviceIds } from '../config/traccar.js';
import { CompanyDevice, DeviceAssignment, Vehicle } from '../models/index.js';
import { Op } from 'sequelize';
import { resolveOdometerForDevice } from '../vehicleEngine/odometer/resolveVehicleOdometer.js';
import { VEHICLE_IDENTITY_ATTRIBUTES } from '../utils/vehicleIdentityAttributes.js';
import {
  computeDue,
  classifyDueBucket,
  formatRemainingLabel,
  scoreMaintenance,
} from './maintenanceDueEngine.js';

function parseMaintenanceAttributes(row) {
  if (!row?.attributes) return {};
  if (typeof row.attributes === 'string') {
    try {
      return JSON.parse(row.attributes);
    } catch {
      return {};
    }
  }
  return row.attributes;
}

async function getCompanyDeviceIds(companyId) {
  try {
    const rows = await CompanyDevice.findAll({
      where: { companyId, isActive: true },
      attributes: ['traccarDeviceId'],
    });
    const ids = rows.map((r) => Number(r.traccarDeviceId)).filter(Number.isFinite);
    if (ids.length) return ids;
  } catch {
    /* fall through */
  }

  const assignments = await DeviceAssignment.findAll({
    where: { isActive: true },
    include: [{
      model: Vehicle,
      where: { companyId: String(companyId) },
      attributes: ['id'],
      required: true,
    }],
    attributes: ['deviceId'],
  });
  return [...new Set(assignments.map((a) => Number(a.deviceId)).filter(Number.isFinite))];
}

async function loadMaintenancesForDevices(deviceIds) {
  if (!deviceIds.length) return [];
  const pool = traccar.getTraccarPool();
  const placeholders = deviceIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT m.id, m.name, m.type, m.start, m.period, m.attributes, dm.deviceid AS deviceId
     FROM tc_maintenances m
     INNER JOIN tc_device_maintenance dm ON dm.maintenanceid = m.id
     WHERE dm.deviceid IN (${placeholders})`,
    deviceIds,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    type: row.type,
    start: Number(row.start),
    period: Number(row.period),
    attributes: parseMaintenanceAttributes(row),
    deviceId: Number(row.deviceId),
  }));
}

async function loadFleetVehicleMap(companyId, deviceIds) {
  const map = new Map();
  if (!deviceIds.length) return map;

  const assignments = await DeviceAssignment.findAll({
    where: { deviceId: { [Op.in]: deviceIds }, isActive: true },
    include: [{
      model: Vehicle,
      where: { companyId: String(companyId) },
      attributes: VEHICLE_IDENTITY_ATTRIBUTES,
      required: true,
    }],
  });

  for (const a of assignments) {
    map.set(Number(a.deviceId), {
      fleetVehicleId: String(a.vehicleId),
      name: a.Vehicle?.name || null,
      plateNumber: a.Vehicle?.plateNumber || null,
    });
  }
  return map;
}

/**
 * Canonical odometer in metres per device — the ONLY mileage maintenance is measured
 * against. `supplied` maps deviceId -> odometer km the caller has ALREADY resolved in
 * this request (so a page and its maintenance section cannot disagree, and the same
 * work is not done twice); a supplied null means "unknown" and is honoured as such.
 * Devices the caller did not supply are resolved through the odometer engine.
 */
async function loadOdometerMetresByDevice(deviceIds, supplied, resolveOdometer) {
  const unique = [...new Set(deviceIds.filter(Number.isFinite))];
  const given = new Map([...(supplied ?? [])].map(([id, km]) => [Number(id), km]));
  const map = new Map();
  await Promise.all(unique.map(async (deviceId) => {
    const km = given.has(deviceId)
      ? given.get(deviceId)
      : (await resolveOdometer(deviceId)).odometerKm;
    map.set(Number(deviceId), km != null && Number.isFinite(Number(km)) ? Number(km) * 1000 : null);
  }));
  return map;
}

async function findActiveAssignment(companyId, fleetVehicleId) {
  return DeviceAssignment.findOne({
    where: { vehicleId: String(fleetVehicleId), isActive: true },
    include: [{
      model: Vehicle,
      where: { companyId: String(companyId) },
      attributes: VEHICLE_IDENTITY_ATTRIBUTES,
      required: true,
    }],
  });
}

/** Real collaborators; tests pass fakes as the last argument of the two loaders below. */
const defaultDeps = {
  getCompanyDeviceIds,
  findActiveAssignment,
  loadMaintenancesForDevices,
  loadLatestPositions: getTraccarLatestPositionsByDeviceIds,
  loadFleetVehicleMap,
  resolveOdometer: resolveOdometerForDevice,
};

/**
 * Due state for each schedule, from the position and the canonical odometer. One
 * builder for the company-wide and the single-vehicle loaders, so they cannot differ.
 */
function buildDueItems(schedules, { positionByDevice, odometerMetresByDevice, vehicleByDevice }) {
  return schedules.map((schedule) => {
    const position = positionByDevice.get(schedule.deviceId);
    const due = computeDue(schedule, position, odometerMetresByDevice.get(schedule.deviceId) ?? null);
    const vehicle = vehicleByDevice.get(schedule.deviceId);
    const bucket = classifyDueBucket(due);
    return {
      ...due,
      deviceId: schedule.deviceId,
      fleetVehicleId: vehicle?.fleetVehicleId || null,
      vehicleName: vehicle?.name || null,
      plateNumber: vehicle?.plateNumber || null,
      bucket,
      remainingLabel: formatRemainingLabel(due),
    };
  });
}

function countBuckets(items) {
  const kpis = { overdue: 0, dueToday: 0, dueThisWeek: 0, dueSoon: 0 };
  for (const item of items) {
    if (item.bucket === 'overdue') kpis.overdue += 1;
    else if (item.bucket === 'dueToday') kpis.dueToday += 1;
    else if (item.bucket === 'dueThisWeek') kpis.dueThisWeek += 1;
    else if (item.bucket === 'dueSoon') kpis.dueSoon += 1;
  }
  return kpis;
}

/**
 * Compute maintenance due state for all company devices.
 * @param {string} companyId
 * @param {{ odometerKmByDevice?: Map<number, number|null> }} [options] canonical odometers the
 *   caller already resolved (km); devices not in the map are resolved here
 */
export async function loadCompanyMaintenanceDueState(companyId, options = {}, deps = defaultDeps) {
  const deviceIds = await deps.getCompanyDeviceIds(companyId);
  const [schedules, positions, vehicleByDevice, odometerMetresByDevice] = await Promise.all([
    deps.loadMaintenancesForDevices(deviceIds),
    deps.loadLatestPositions(deviceIds),
    deps.loadFleetVehicleMap(companyId, deviceIds),
    loadOdometerMetresByDevice(deviceIds, options.odometerKmByDevice, deps.resolveOdometer),
  ]);

  const positionByDevice = new Map(
    positions.map((p) => [Number(p.deviceId), p]),
  );

  const computed = buildDueItems(schedules, { positionByDevice, odometerMetresByDevice, vehicleByDevice });
  const kpis = countBuckets(computed);

  const perVehicle = new Map();
  for (const item of computed) {
    if (!item.fleetVehicleId) continue;
    const list = perVehicle.get(item.fleetVehicleId) || [];
    list.push(item);
    perVehicle.set(item.fleetVehicleId, list);
  }

  const perVehicleScores = [];
  for (const items of perVehicle.values()) {
    const score = scoreMaintenance(items);
    if (score != null) perVehicleScores.push(score);
  }

  return {
    items: computed,
    kpis,
    perVehicle,
    perVehicleScores,
  };
}

/**
 * Maintenance due state for a single fleet vehicle (device-scoped, no full-fleet scan).
 * @param {string} companyId
 * @param {string} fleetVehicleId
 * @param {{ odometerKm?: number|null }} [options] the canonical odometer (km) the caller has
 *   already resolved for this vehicle. A number or null is used as given (null = unknown);
 *   undefined means "resolve it here".
 */
export async function loadVehicleMaintenanceDueState(companyId, fleetVehicleId, options = {}, deps = defaultDeps) {
  const assignment = await deps.findActiveAssignment(companyId, fleetVehicleId);

  if (!assignment) {
    return {
      items: [],
      kpis: { overdue: 0, dueToday: 0, dueThisWeek: 0, dueSoon: 0 },
      healthScore: null,
    };
  }

  const deviceId = Number(assignment.deviceId);
  const vehicle = assignment.Vehicle;
  const supplied = options.odometerKm !== undefined ? new Map([[deviceId, options.odometerKm]]) : null;
  const [schedules, positions, odometerMetresByDevice] = await Promise.all([
    deps.loadMaintenancesForDevices([deviceId]),
    deps.loadLatestPositions([deviceId]),
    loadOdometerMetresByDevice([deviceId], supplied, deps.resolveOdometer),
  ]);

  const positionByDevice = new Map(positions.map((p) => [Number(p.deviceId), p]));
  const vehicleByDevice = new Map([[deviceId, {
    fleetVehicleId: String(fleetVehicleId),
    name: vehicle?.name || null,
    plateNumber: vehicle?.plateNumber || null,
  }]]);

  const computed = buildDueItems(schedules, { positionByDevice, odometerMetresByDevice, vehicleByDevice });
  const kpis = countBuckets(computed);
  const healthScore = scoreMaintenance(computed);

  return { items: computed, kpis, healthScore };
}

export async function getOnlineDeviceCount(companyId) {
  const deviceIds = await getCompanyDeviceIds(companyId);
  if (!deviceIds.length) return { total: 0, online: 0 };

  try {
    const pool = traccar.getTraccarPool();
    const placeholders = deviceIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN lastupdate >= NOW() - INTERVAL 5 MINUTE THEN 1 ELSE 0 END) AS online
       FROM tc_devices WHERE id IN (${placeholders})`,
      deviceIds,
    );
    const row = rows[0] || {};
    return { total: Number(row.total || 0), online: Number(row.online || 0) };
  } catch {
    return { total: deviceIds.length, online: 0 };
  }
}
