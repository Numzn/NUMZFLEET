import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { Vehicle, DeviceAssignment, VehicleSpec } from '../models/index.js';
import {
  getTraccarDevice,
  getTraccarDevicesByIds,
  getTraccarLatestPositionsByDeviceIds,
  upsertTraccarDeviceAttribute,
} from '../config/traccar.js';

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
      }
    : null;

  let positionDto = null;
  if (pos && pos.latitude != null && pos.longitude != null) {
    positionDto = {
      latitude: Number(pos.latitude),
      longitude: Number(pos.longitude),
      speed: pos.speed != null ? Number(pos.speed) : null,
      fixTime: pos.fixtime ? new Date(pos.fixtime).toISOString() : null,
    };
  }

  const vehicleSpecDto = spec
    ? {
        tankCapacity: spec.tankCapacity,
        fuelEfficiency: spec.fuelEfficiency,
        fuelType: spec.fuelType,
      }
    : null;

  return {
    ...base,
    assignment: assignmentDto,
    device: deviceDto,
    position: positionDto,
    vehicleSpec: vehicleSpecDto,
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
  return Vehicle.create({
    name: trimmed,
    plateNumber: plateNumber != null && String(plateNumber).trim() !== ''
      ? String(plateNumber).trim()
      : null,
  });
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
export async function assignDevice(vehicleId, deviceId) {
  const vid = String(vehicleId);
  const did = Number(deviceId);
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

  await sequelize.transaction(async (t) => {
    const now = new Date();
    await DeviceAssignment.update(
      { isActive: false, unassignedAt: now },
      { where: { vehicleId: vid, isActive: true }, transaction: t },
    );
    await DeviceAssignment.update(
      { isActive: false, unassignedAt: now },
      { where: { deviceId: did, isActive: true }, transaction: t },
    );
    await DeviceAssignment.create(
      {
        vehicleId: vid,
        deviceId: did,
        isActive: true,
        assignedAt: now,
      },
      { transaction: t },
    );
  });

  // Keep Traccar device labels in sync with fleet assignment for map rendering.
  // This runs after DB commit and is best-effort; assignment should not fail if label sync fails.
  try {
    // 1) Clear stale label on previously assigned device (if vehicle moved to another device).
    if (
      previousVehicleAssignment
      && Number(previousVehicleAssignment.deviceId) !== did
    ) {
      await upsertTraccarDeviceAttribute(Number(previousVehicleAssignment.deviceId), 'vehicleName', null);
      await upsertTraccarDeviceAttribute(Number(previousVehicleAssignment.deviceId), 'fleetVehicleId', null);
    }

    // 2) Set active assignment label on current device.
    await upsertTraccarDeviceAttribute(did, 'vehicleName', vehicle.name);
    await upsertTraccarDeviceAttribute(did, 'fleetVehicleId', Number(vid));
  } catch (error) {
    console.warn('[vehicleFleetService] Device label sync failed after assignment commit:', error?.message || error);
  }

  return getVehicleMerged(vid);
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
