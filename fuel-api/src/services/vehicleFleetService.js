import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { Vehicle, DeviceAssignment, VehicleSpec, DEFAULT_COMPANY_ID } from '../models/index.js';
import {
  getTraccarDevice,
  getTraccarDevicesByIds,
  getAllTraccarDevicesWithAttributes,
  getTraccarLatestPositionsByDeviceIds,
  upsertTraccarDeviceAttribute,
  updateTraccarDeviceName,
} from '../config/traccar.js';
import { resolveVehicleDisplayFromModels } from '../utils/resolveVehicleDisplay.js';
import { ensureDeviceInCompany } from './companyProvisioningService.js';
import { emitDomainEvent } from '../events/eventBus.js';
import { EVENT_NAMES } from '../events/eventNames.js';
import { normalizePositionTelemetry } from '../utils/normalizeTelemetry.js';
import {
  parseTraccarAttributesRaw,
  parseDeviceFleetConfig,
  mergeFleetConfigFromBody,
} from '../utils/fleetConfigUtils.js';
import { updateVehicleSpec } from './vehicleSpecService.js';
import { summarizeForVehicle } from '../repositories/serviceRecordRepository.js';
import { buildVehicleAttachmentPath } from '../middleware/vehicleUpload.js';

/**
 * v1 merged vehicle DTO — single shape for list and get-by-id.
 * Merge logic lives only in this module (see fleet plan).
 */
function toMergedDto(vehicle, assignment, deviceMap, positionMap, specMap) {
  const base = {
    id: vehicle.id,
    name: vehicle.name,
    plateNumber: vehicle.plateNumber ?? null,
    notes: vehicle.notes ?? null,
    make: vehicle.make ?? null,
    model: vehicle.model ?? null,
    homeBaseLabel: vehicle.homeBaseLabel ?? null,
    photoUrl: vehicle.photoFileId ? buildVehicleAttachmentPath(vehicle.photoFileId) : null,
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
  const deviceMap = new Map();
  const positionMap = new Map();

  if (deviceIds?.length) {
    try {
      const devices = await getTraccarDevicesByIds(deviceIds);
      for (const d of devices) {
        deviceMap.set(Number(d.id), d);
      }
    } catch (err) {
      console.error('[vehicleFleet] Traccar device batch load failed (listing still works without device fields):', err?.message || err);
    }
    try {
      const positions = await getTraccarLatestPositionsByDeviceIds(deviceIds);
      for (const p of positions) {
        if (p.deviceId != null) positionMap.set(Number(p.deviceId), p);
      }
    } catch (err) {
      console.error('[vehicleFleet] Traccar position batch load failed (listing still works without positions):', err?.message || err);
    }
  }

  const specs = deviceIds.length
    ? await VehicleSpec.findAll({ where: { deviceId: { [Op.in]: deviceIds } } })
    : [];
  const specMap = new Map(specs.map((s) => [Number(s.deviceId), s]));
  return { deviceMap, positionMap, specMap };
}

async function syncVehicleDeviceLabels(vehicle, deviceId) {
  const display = resolveVehicleDisplayFromModels(vehicle);
  await upsertTraccarDeviceAttribute(deviceId, 'vehicleName', display.primary);
  if (vehicle.plateNumber) {
    await upsertTraccarDeviceAttribute(deviceId, 'plateNumber', vehicle.plateNumber);
  }
  await upsertTraccarDeviceAttribute(deviceId, 'fleetVehicleId', String(vehicle.id));
  await updateTraccarDeviceName(deviceId, display.primary);
}

export async function assertVehicleInTenant(vehicleId, companyId = DEFAULT_COMPANY_ID) {
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }
  if (companyId && vehicle.companyId && vehicle.companyId !== companyId) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }
  return vehicle;
}

export async function createVehicle({ name, plateNumber, companyId }) {
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
  const scopedCompanyId = companyId || DEFAULT_COMPANY_ID;
  const orConditions = [{ name: trimmed }];
  if (plate) orConditions.push({ plateNumber: plate });
  const existing = await Vehicle.findOne({
    where: { companyId: scopedCompanyId, [Op.or]: orConditions },
  });
  if (existing) {
    const field = existing.name.toLowerCase() === trimmed.toLowerCase() ? 'name' : 'plate number';
    const err = new Error(`A vehicle with that ${field} already exists`);
    err.statusCode = 409;
    throw err;
  }

  return Vehicle.create({
    name: trimmed,
    plateNumber: plate,
    companyId: companyId || DEFAULT_COMPANY_ID,
  });
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

export async function patchVehicleFields(id, fields = {}, companyId = null) {
  const vehicle = await Vehicle.findByPk(id);
  if (!vehicle) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }
  if (companyId && vehicle.companyId && vehicle.companyId !== companyId) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }

  const patch = {};
  if (fields.notes !== undefined) patch.notes = fields.notes != null ? String(fields.notes) : null;
  if (fields.make !== undefined) patch.make = fields.make != null ? String(fields.make).trim() || null : null;
  if (fields.model !== undefined) patch.model = fields.model != null ? String(fields.model).trim() || null : null;
  if (fields.homeBaseLabel !== undefined) {
    patch.homeBaseLabel = fields.homeBaseLabel != null ? String(fields.homeBaseLabel).trim() || null : null;
  }
  if (fields.photoFileId !== undefined) {
    patch.photoFileId = fields.photoFileId != null ? String(fields.photoFileId) : null;
  }

  if (Object.keys(patch).length === 0) {
    const err = new Error('No valid fields to update');
    err.statusCode = 400;
    throw err;
  }

  await vehicle.update(patch);
  return getVehicleMerged(id, companyId || vehicle.companyId);
}

export async function deleteVehicle(id) {
  const vid = String(id);
  const vehicle = await Vehicle.findByPk(vid);
  if (!vehicle) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }

  const activeAssignment = await DeviceAssignment.findOne({
    where: { vehicleId: vid, isActive: true },
  });

  await sequelize.transaction(async (transaction) => {
    // Rows must be removed — FK is ON DELETE RESTRICT; soft-deactivate alone blocks destroy().
    await DeviceAssignment.destroy({ where: { vehicleId: vid }, transaction });
    await vehicle.destroy({ transaction });
  });

  if (activeAssignment?.deviceId != null) {
    try {
      await upsertTraccarDeviceAttribute(Number(activeAssignment.deviceId), 'fleetVehicleId', null);
      await upsertTraccarDeviceAttribute(Number(activeAssignment.deviceId), 'vehicleName', null);
    } catch (traccarErr) {
      console.warn(
        'Vehicle deleted in Postgres but Traccar device labels were not cleared:',
        traccarErr?.message || traccarErr,
      );
    }
  }
}

/** Traccar device ids with an active fleet assignment for the company (no Traccar HTTP). */
export async function listAssignedDeviceIdsForCompany(companyId = DEFAULT_COMPANY_ID) {
  const scopedCompanyId = companyId || DEFAULT_COMPANY_ID;
  const vehicles = await Vehicle.findAll({
    where: { companyId: scopedCompanyId },
    attributes: ['id'],
  });
  if (!vehicles.length) return [];

  const vehicleIds = vehicles.map((v) => v.id);
  const assignments = await DeviceAssignment.findAll({
    where: { vehicleId: { [Op.in]: vehicleIds }, isActive: true },
    attributes: ['deviceId'],
  });

  return [...new Set(
    assignments
      .map((a) => Number(a.deviceId))
      .filter((id) => Number.isFinite(id) && id > 0),
  )].sort((a, b) => a - b);
}

export async function listVehiclesMerged(companyId = DEFAULT_COMPANY_ID) {
  const vehicles = await Vehicle.findAll({
    where: { companyId },
    order: [['name', 'ASC']],
  });
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

export async function getVehicleMerged(id, companyId = null) {
  const vehicle = await Vehicle.findByPk(id);
  if (!vehicle) return null;
  if (companyId && vehicle.companyId && vehicle.companyId !== companyId) return null;

  const assignment = await DeviceAssignment.findOne({
    where: { vehicleId: id, isActive: true },
  });
  const deviceIds = assignment ? [Number(assignment.deviceId)] : [];
  const { deviceMap, positionMap, specMap } = await loadMergeMapsForDeviceIds(deviceIds);

  const merged = toMergedDto(vehicle, assignment, deviceMap, positionMap, specMap);
  const effectiveCompanyId = companyId || vehicle.companyId || DEFAULT_COMPANY_ID;
  merged.serviceSummary = await summarizeForVehicle(id, effectiveCompanyId);
  return merged;
}

export async function listDeviceAssignments(vehicleId, companyId = null) {
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) return null;
  if (companyId && vehicle.companyId && vehicle.companyId !== companyId) return null;
  const rows = await DeviceAssignment.findAll({
    where: { vehicleId: String(vehicleId) },
    order: [['assignedAt', 'DESC']],
  });
  return rows.map((r) => ({
    id: r.id,
    deviceId: Number(r.deviceId),
    assignedAt: r.assignedAt?.toISOString?.() || r.assignedAt,
    unassignedAt: r.unassignedAt?.toISOString?.() || r.unassignedAt,
    isActive: r.isActive,
  }));
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

  try {
    await syncVehicleDeviceLabels(vehicle, did);
    await ensureDeviceInCompany(vehicle.companyId || DEFAULT_COMPANY_ID, did, vid);
  } catch (err) {
    console.error('[vehicleFleet] label sync after assign failed:', err?.message || err);
  }

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
 * Backfills Traccar device label attributes from active assignments and clears
 * stale fleetVehicleId values left on devices after vehicle delete or DB restore.
 * Safe to run at startup.
 */
export async function reconcileDeviceAssignmentLabels() {
  const activeAssignments = await DeviceAssignment.findAll({
    where: { isActive: true },
    attributes: ['vehicleId', 'deviceId'],
  });

  const expectedFleetVehicleIdByDevice = new Map(
    activeAssignments.map((a) => [Number(a.deviceId), String(a.vehicleId)]),
  );

  const vehicleIds = [...new Set(activeAssignments.map((a) => String(a.vehicleId)))];
  const vehicles = vehicleIds.length
    ? await Vehicle.findAll({
        where: { id: { [Op.in]: vehicleIds } },
        attributes: ['id', 'name', 'plateNumber'],
      })
    : [];
  const vehicleById = new Map(vehicles.map((v) => [String(v.id), v]));

  let synced = 0;
  let failed = 0;

  for (const assignment of activeAssignments) {
    const deviceId = Number(assignment.deviceId);
    const vehicleId = String(assignment.vehicleId);
    const vehicle = vehicleById.get(vehicleId);
    if (!Number.isFinite(deviceId) || !vehicle) {
      failed += 1;
      continue;
    }

    try {
      await syncVehicleDeviceLabels(vehicle, deviceId);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  let cleared = 0;
  try {
    const traccarDevices = await getAllTraccarDevicesWithAttributes();
    for (const device of traccarDevices) {
      const deviceId = Number(device.id);
      if (!Number.isFinite(deviceId)) continue;

      const attrs = parseTraccarAttributesRaw(device.attributes);
      const stored = attrs.fleetVehicleId != null && String(attrs.fleetVehicleId).trim() !== ''
        ? String(attrs.fleetVehicleId)
        : null;
      if (!stored) continue;

      const expected = expectedFleetVehicleIdByDevice.get(deviceId) ?? null;
      if (expected === stored) continue;

      await upsertTraccarDeviceAttribute(deviceId, 'fleetVehicleId', null);
      if (!expected) {
        await upsertTraccarDeviceAttribute(deviceId, 'vehicleName', null);
      }
      cleared += 1;
    }
  } catch (err) {
    console.warn('[vehicle-label-reconcile] stale attribute cleanup skipped:', err?.message || err);
  }

  return {
    total: activeAssignments.length,
    synced,
    failed,
    cleared,
  };
}
