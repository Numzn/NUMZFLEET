import { Op } from 'sequelize';
import { Vehicle, DeviceAssignment } from '../models/index.js';
import { getTraccarDevicesByIds, getTraccarLatestPositionsByDeviceIds } from '../config/traccar.js';
import { getAccessibleCompanyIds } from './scopeValidationService.js';

function toDeviceDto(row) {
  return {
    id: row.id,
    name: row.name,
    uniqueId: row.uniqueid ?? null,
    status: row.status,
    lastUpdate: row.lastupdate ? new Date(row.lastupdate).toISOString() : null,
    positionId: row.positionid ?? null,
    attributes: row.attributes && typeof row.attributes === 'object' ? row.attributes : {},
  };
}

function toPositionDto(row) {
  return {
    id: row.id,
    deviceId: row.deviceId,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    speed: row.speed != null ? Number(row.speed) : null,
    course: row.course != null ? Number(row.course) : null,
    altitude: row.altitude != null ? Number(row.altitude) : null,
    fixTime: row.fixtime ? new Date(row.fixtime).toISOString() : null,
    serverTime: row.servertime ? new Date(row.servertime).toISOString() : null,
    attributes: row.attributes && typeof row.attributes === 'object' ? row.attributes : {},
  };
}

/**
 * Company-scoped device + position snapshot — the fuel-api-mediated
 * equivalent of Traccar's own GET /api/devices + GET /api/positions, so the
 * Dashboard and Live Map can be governed by the same company_id boundary the
 * Vehicles registry already uses. This does not replace Traccar's own
 * session/WS auth — it adds a company-filtered alternative for the
 * initial/periodic snapshot fetch, backed by the same getAccessibleCompanyIds()
 * the rest of fuel-api's tenancy already uses.
 */
/**
 * The security-relevant part of getFleetDeviceSnapshot, isolated so it can
 * be tested against real vehicle/assignment rows without needing live
 * Traccar device/position data — see fleetDeviceSnapshotService.test.js.
 *
 * Sources device ids from vehicles.company_id + active device_assignments —
 * the same join listVehiclesMerged's toMergedDto path relies on, and the
 * one truly authoritative link, written transactionally inside assignDevice's
 * own DB transaction. NOT company_devices: that table is written best-effort,
 * after the transaction, purely as a cache for other consumers (fleet KPIs,
 * maintenance) — it can drift from the real vehicle/device relationship, and
 * Live Map visibility must not inherit that drift.
 */
export async function getAccessibleTraccarDeviceIds(auth) {
  const accessibleIds = getAccessibleCompanyIds(auth);

  const where = {};
  if (accessibleIds !== null) {
    if (!accessibleIds.length) return [];
    where.companyId = accessibleIds.length === 1 ? accessibleIds[0] : { [Op.in]: accessibleIds };
  }

  const vehicles = await Vehicle.findAll({ where, attributes: ['id'] });
  if (!vehicles.length) return [];
  const vehicleIds = vehicles.map((v) => v.id);

  const assignments = await DeviceAssignment.findAll({
    where: { vehicleId: { [Op.in]: vehicleIds }, isActive: true },
    attributes: ['deviceId'],
  });
  return [...new Set(
    assignments.map((a) => Number(a.deviceId)).filter((n) => Number.isFinite(n)),
  )];
}

export async function getFleetDeviceSnapshot(auth) {
  const deviceIds = await getAccessibleTraccarDeviceIds(auth);

  if (!deviceIds.length) {
    return { devices: [], positions: [] };
  }

  const [devices, positions] = await Promise.all([
    getTraccarDevicesByIds(deviceIds),
    getTraccarLatestPositionsByDeviceIds(deviceIds),
  ]);

  return {
    devices: devices.map(toDeviceDto),
    positions: positions.filter((p) => p.latitude != null && p.longitude != null).map(toPositionDto),
  };
}

export default { getFleetDeviceSnapshot, getAccessibleTraccarDeviceIds };
