import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { Vehicle, DeviceAssignment, VehicleSpec } from '../models/index.js';
import {
  getTraccarDevice,
  getTraccarDevicesByIds,
  getTraccarLatestPositionsByDeviceIds,
  upsertTraccarDeviceAttribute,
} from '../config/traccar.js';
import { emitDomainEvent } from '../events/eventBus.js';
import { EVENT_NAMES } from '../events/eventNames.js';
import { normalizePositionTelemetry } from '../utils/normalizeTelemetry.js';
import {
  parseTraccarAttributesRaw,
  parseDeviceFleetConfig,
  mergeFleetConfigFromBody,
} from '../utils/fleetConfigUtils.js';
import { updateVehicleSpec } from './vehicleSpecService.js';

/**
 * v1 merged vehicle DTO — single shape for list and get-by-id.
 * Merge logic lives only in this module (see fleet plan).
 */
function toMergedDto(vehicle, assignment, deviceMap, positionMap, specMap) {
  const base = {
    id: vehicle.id,
    name: vehicle.name,
    plateNumber: vehicle.plateNumber ?? null,
  };

  if (!assignment) {
    return {
      ...base,
      assignment: null,
      device: null,
      position: null,
      vehicleSpec: null,
      fleetConfig: null,
    };
  }

  const deviceId = Number(assignment.deviceId);
  const tr = deviceMap.get(deviceId);
  const pos = positionMap.get(deviceId);
  const spec = specMap.get(deviceId);

  const assignmentDto = {
    deviceId,
    assignedAt: assignment.assignedAt?.toISOString?.() || assignment.assignedAt,
  };

  const deviceDto = tr
    ? {
        id: tr.id,
        name: tr.name,
        status: tr.status,
        uniqueId: tr.uniqueid ?? tr.uniqueId ?? null,
        lastUpdate: tr.lastupdate ? new Date(tr.lastupdate).toISOString() : null,
      }
    : null;

  let positionDto = null;
  if (pos && pos.latitude != null && pos.longitude != null) {
    const attrs = pos.attributes && typeof pos.attributes === 'object' ? pos.attributes : {};
    positionDto = {
      latitude: Number(pos.latitude),
      longitude: Number(pos.longitude),
      speed: pos.speed != null ? Number(pos.speed) : null,
      course: pos.course != null ? Number(pos.course) : null,
      altitude: pos.altitude != null ? Number(pos.altitude) : null,
      fixTime: pos.fixtime ? new Date(pos.fixtime).toISOString() : null,
      telemetry: normalizePositionTelemetry(attrs),
    };
  }

  const vehicleSpecDto = spec
    ? {
        tankCapacity: spec.tankCapacity,
        fuelEfficiency: spec.fuelEfficiency,
        fuelType: spec.fuelType,
      }
    : null;

  const devAttrs = tr ? parseTraccarAttributesRaw(tr.attributes) : {};
  const fleetConfig = tr ? parseDeviceFleetConfig(devAttrs) : null;

  return {
    ...base,
    assignment: assignmentDto,
    device: deviceDto,
    position: positionDto,
    vehicleSpec: vehicleSpecDto,
    fleetConfig,
  };
}

async function loadMergeMapsForDeviceIds(deviceIds) {
  const devices = await getTraccarDevicesByIds(deviceIds);
  const positions = await getTraccarLatestPositionsByDeviceIds(deviceIds);
  const deviceMap = new Map(devices.map((d) => [Number(d.id), d]));
  const positionMap = new Map(
    positions.filter((p) => p.deviceId != null).map((p) => [Number(p.deviceId), p]),
  );
  const specs = deviceIds.length
    ? await VehicleSpec.findAll({ where: { deviceId: { [Op.in]: deviceIds } } })
    : [];
  const specMap = new Map(specs.map((s) => [Number(s.deviceId), s]));
  return { deviceMap, positionMap, specMap };
}

export async function createVehicle({ name, plateNumber }) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }
  const plate = plateNumber != null && String(plateNumber).trim() !== ''
    ? String(plateNumber).trim()
    : null;

  // Duplicate check: same name (case-insensitive) or same plate
  const orConditions = [{ name: trimmed }];
  if (plate) orConditions.push({ plateNumber: plate });
  const existing = await Vehicle.findOne({ where: { [Op.or]: orConditions } });
  if (existing) {
    const field = existing.name.toLowerCase() === trimmed.toLowerCase() ? 'name' : 'plate number';
    const err = new Error(`A vehicle with that ${field} already exists`);
    err.statusCode = 409;
    throw err;
  }

  return Vehicle.create({ name: trimmed, plateNumber: plate });
}

export async function updateVehicle(id, { name, plateNumber }) {
  const vehicle = await Vehicle.findByPk(id);
  if (!vehicle) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }
  const trimmed = (name || '').trim();
  if (!trimmed) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }
  const plate = plateNumber != null && String(plateNumber).trim() !== ''
    ? String(plateNumber).trim()
    : null;

  // Duplicate check: exclude this vehicle
  const orConditions = [{ name: trimmed }];
  if (plate) orConditions.push({ plateNumber: plate });
  const existing = await Vehicle.findOne({
    where: { [Op.or]: orConditions, id: { [Op.ne]: id } },
  });
  if (existing) {
    const field = existing.name.toLowerCase() === trimmed.toLowerCase() ? 'name' : 'plate number';
    const err = new Error(`A vehicle with that ${field} already exists`);
    err.statusCode = 409;
    throw err;
  }

  await vehicle.update({ name: trimmed, plateNumber: plate });
  return getVehicleMerged(id);
}

export async function deleteVehicle(id) {
  const vehicle = await Vehicle.findByPk(id);
  if (!vehicle) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }
  // Deactivate any device assignments first
  await DeviceAssignment.update({ isActive: false }, { where: { vehicleId: id } });
  await vehicle.destroy();
}

export async function listVehiclesMerged() {
  const vehicles = await Vehicle.findAll({ order: [['name', 'ASC']] });
  const vehicleIds = vehicles.map((v) => v.id);
  const assignments = vehicleIds.length
    ? await DeviceAssignment.findAll({
        where: { vehicleId: { [Op.in]: vehicleIds }, isActive: true },
      })
    : [];
  const assignmentByVehicleId = new Map(assignments.map((a) => [a.vehicleId, a]));
  const deviceIds = [...new Set(assignments.map((a) => Number(a.deviceId)))];
  const { deviceMap, positionMap, specMap } = await loadMergeMapsForDeviceIds(deviceIds);

  return vehicles.map((v) =>
    toMergedDto(v, assignmentByVehicleId.get(v.id), deviceMap, positionMap, specMap),
  );
}

export async function getVehicleMerged(id) {
  const vehicle = await Vehicle.findByPk(id);
  if (!vehicle) return null;

  const assignment = await DeviceAssignment.findOne({
    where: { vehicleId: id, isActive: true },
  });
  const deviceIds = assignment ? [Number(assignment.deviceId)] : [];
  const { deviceMap, positionMap, specMap } = await loadMergeMapsForDeviceIds(deviceIds);

  return toMergedDto(vehicle, assignment, deviceMap, positionMap, specMap);
}

/**
 * Deactivate active rows for this vehicle and this device, then insert a new active row.
 */
export async function assignDevice(vehicleId, deviceId, options = {}) {
  const vid = String(vehicleId);
  const did = Number(deviceId);
  const actorUserId = options.actorUserId != null ? Number(options.actorUserId) : null;
  if (!Number.isFinite(did) || did <= 0) {
    const err = new Error('deviceId must be a positive Traccar device id');
    err.statusCode = 400;
    throw err;
  }

  const vehicle = await Vehicle.findByPk(vid);
  if (!vehicle) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }

  const trDevice = await getTraccarDevice(did);
  if (!trDevice) {
    const err = new Error('Traccar device not found');
    err.statusCode = 404;
    throw err;
  }

  const previousVehicleAssignment = await DeviceAssignment.findOne({
    where: { vehicleId: vid, isActive: true },
  });

  const assignedAt = new Date();

  await sequelize.transaction(async (t) => {
    await DeviceAssignment.update(
      { isActive: false, unassignedAt: assignedAt },
      { where: { vehicleId: vid, isActive: true }, transaction: t },
    );
    await DeviceAssignment.update(
      { isActive: false, unassignedAt: assignedAt },
      { where: { deviceId: did, isActive: true }, transaction: t },
    );
    await DeviceAssignment.create(
      {
        vehicleId: vid,
        deviceId: did,
        isActive: true,
        assignedAt,
      },
      { transaction: t },
    );
  });

  emitDomainEvent(EVENT_NAMES.VEHICLE_ASSIGNED, {
    vehicleId: Number(vid),
    deviceId: did,
    vehicleName: vehicle.name,
    previousDeviceId: previousVehicleAssignment ? Number(previousVehicleAssignment.deviceId) : null,
    assignedAt: assignedAt.toISOString(),
    actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
  });

  return getVehicleMerged(vid);
}

/**
 * Unified config: vehicle row, vehicle_specs, and Traccar `numzFleetConfig` on device attributes.
 * @param {string} vehicleId — UUID
 * @param {object} body — partial updates (name, plateNumber, tankCapacity, fuelType, fuelEfficiency,
 *   fuelConsumptionLPer100km, vehicleType, lowFuelThresholdPct, updateIntervalSec, geofenceEnabled,
 *   geofenceRadiusM, alerts)
 */
export async function updateVehicleMergedConfig(vehicleId, body = {}) {
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }

  const assignment = await DeviceAssignment.findOne({
    where: { vehicleId, isActive: true },
  });

  const wantsVehicleFields = body.name !== undefined || body.plateNumber !== undefined;
  const specKeysTouched = ['tankCapacity', 'fuelEfficiency', 'fuelType', 'fuelConsumptionLPer100km'].some(
    (k) => Object.prototype.hasOwnProperty.call(body, k),
  );
  const wantsSpec = specKeysTouched;
  const fleetPatchKeys = [
    'vehicleType',
    'lowFuelThresholdPct',
    'updateIntervalSec',
    'geofenceEnabled',
    'geofenceRadiusM',
    'alerts',
  ];
  const wantsFleetPatch = fleetPatchKeys.some((k) => Object.prototype.hasOwnProperty.call(body, k));

  if ((wantsSpec || wantsFleetPatch) && !assignment) {
    const err = new Error('Assign a Traccar device before saving fuel or tracking settings');
    err.statusCode = 400;
    throw err;
  }

  if (wantsVehicleFields) {
    await updateVehicle(vehicleId, {
      name: body.name !== undefined ? body.name : vehicle.name,
      plateNumber: body.plateNumber !== undefined ? body.plateNumber : vehicle.plateNumber,
    });
  }

  if (wantsSpec && assignment) {
    const deviceId = Number(assignment.deviceId);
    const existing = await VehicleSpec.findOne({ where: { deviceId } });
    let fuelEff =
      body.fuelEfficiency != null ? Number(body.fuelEfficiency) : existing?.fuelEfficiency ?? 10;
    if (body.fuelConsumptionLPer100km != null) {
      const l100 = Number(body.fuelConsumptionLPer100km);
      if (l100 > 0) fuelEff = 100 / l100;
    }
    await updateVehicleSpec(deviceId, {
      tankCapacity:
        body.tankCapacity != null ? Number(body.tankCapacity) : existing?.tankCapacity ?? 60,
      fuelEfficiency: fuelEff,
      fuelType:
        body.fuelType != null ? body.fuelType : existing?.fuelType ?? 'Petrol',
    });
  }

  if (wantsFleetPatch && assignment) {
    const deviceId = Number(assignment.deviceId);
    const devices = await getTraccarDevicesByIds([deviceId]);
    const tr = devices[0];
    const devAttrs = parseTraccarAttributesRaw(tr?.attributes);
    const current = parseDeviceFleetConfig(devAttrs);
    const next = mergeFleetConfigFromBody(current, body);
    await upsertTraccarDeviceAttribute(deviceId, 'numzFleetConfig', next);
  }

  return getVehicleMerged(vehicleId);
}

/**
 * Backfills Traccar device label attributes from active assignments.
 * Safe to run at startup to reconcile labels for assignments created before label-sync existed.
 */
export async function reconcileDeviceAssignmentLabels() {
  const activeAssignments = await DeviceAssignment.findAll({
    where: { isActive: true },
    attributes: ['vehicleId', 'deviceId'],
  });

  if (!activeAssignments.length) {
    return { total: 0, synced: 0, failed: 0 };
  }

  const vehicleIds = [...new Set(activeAssignments.map((a) => String(a.vehicleId)))];
  const vehicles = await Vehicle.findAll({
    where: { id: { [Op.in]: vehicleIds } },
    attributes: ['id', 'name'],
  });
  const vehicleNameById = new Map(vehicles.map((v) => [String(v.id), v.name]));

  let synced = 0;
  let failed = 0;

  for (const assignment of activeAssignments) {
    const deviceId = Number(assignment.deviceId);
    const vehicleId = String(assignment.vehicleId);
    const vehicleName = vehicleNameById.get(vehicleId);
    if (!Number.isFinite(deviceId) || !vehicleName) {
      failed += 1;
      continue;
    }

    try {
      await upsertTraccarDeviceAttribute(deviceId, 'vehicleName', vehicleName);
      await upsertTraccarDeviceAttribute(deviceId, 'fleetVehicleId', Number(vehicleId));
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    total: activeAssignments.length,
    synced,
    failed,
  };
}
