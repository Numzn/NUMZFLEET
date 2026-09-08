import { Op } from 'sequelize';
import { CompanyDevice } from '../models/index.js';
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
 * Vehicles registry already uses (Vehicle Visibility Audit, D2). This does
 * not replace Traccar's own session/WS auth — it adds a company-filtered
 * alternative for the initial/periodic snapshot fetch, backed by the same
 * getAccessibleCompanyIds() the rest of fuel-api's tenancy already uses.
 *
 * Scope note: for a platform-scoped caller (accessibleIds === null) this
 * returns every device present in company_devices across all companies —
 * i.e. every device some company has actually claimed via ensureDeviceInCompany
 * — not literally every device Traccar has ever seen. A device with no
 * company_devices row yet (never assigned to a vehicle) is out of scope for
 * this endpoint either way, matching how an unassigned device has no fleet
 * meaning yet on the Vehicles registry either.
 */
/**
 * The security-relevant part of getFleetDeviceSnapshot, isolated so it can
 * be tested against real company_devices rows without needing live Traccar
 * device/position data — see fleetDeviceSnapshotService.test.js. Same
 * getAccessibleCompanyIds() scoping listVehiclesMerged uses (Vehicle
 * Visibility Audit, D2): platform → all companies, partner → own + child
 * customers, customer → own company only.
 */
export async function getAccessibleTraccarDeviceIds(auth) {
  const accessibleIds = getAccessibleCompanyIds(auth);

  const where = { isActive: true };
  if (accessibleIds !== null) {
    if (!accessibleIds.length) return [];
    where.companyId = accessibleIds.length === 1 ? accessibleIds[0] : { [Op.in]: accessibleIds };
  }

  const companyDevices = await CompanyDevice.findAll({ where, attributes: ['traccarDeviceId'] });
  return [...new Set(
    companyDevices.map((d) => Number(d.traccarDeviceId)).filter((n) => Number.isFinite(n)),
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
