import { Op } from 'sequelize';
import { DeviceAssignment, Vehicle } from '../models/index.js';
import {
  resolveVehicleDisplayFromModels,
  formatVehicleDisplayLine,
} from '../utils/resolveVehicleDisplay.js';

/**
 * @param {number} deviceId
 * @returns {Promise<ReturnType<typeof resolveVehicleDisplayFromModels>>}
 */
export async function getVehicleDisplayByDeviceId(deviceId) {
  if (deviceId == null || !Number.isFinite(Number(deviceId))) {
    return resolveVehicleDisplayFromModels(null);
  }
  const did = Number(deviceId);
  const assignment = await DeviceAssignment.findOne({
    where: { deviceId: did, isActive: true },
    include: [{ model: Vehicle, attributes: ['id', 'name', 'plateNumber'] }],
  });
  if (!assignment?.Vehicle) {
    return resolveVehicleDisplayFromModels(null, { id: did });
  }
  return resolveVehicleDisplayFromModels(assignment.Vehicle, { id: did });
}

/**
 * @param {number[]} deviceIds
 * @returns {Promise<Map<number, ReturnType<typeof resolveVehicleDisplayFromModels>>>}
 */
export async function getVehicleDisplayMapByDeviceIds(deviceIds = []) {
  const ids = [...new Set(deviceIds.map((id) => Number(id)).filter(Number.isFinite))];
  const map = new Map();
  if (!ids.length) return map;

  const assignments = await DeviceAssignment.findAll({
    where: { deviceId: { [Op.in]: ids }, isActive: true },
    include: [{ model: Vehicle, attributes: ['id', 'name', 'plateNumber'] }],
  });

  for (const assignment of assignments) {
    const did = Number(assignment.deviceId);
    map.set(did, resolveVehicleDisplayFromModels(assignment.Vehicle, { id: did }));
  }

  for (const did of ids) {
    if (!map.has(did)) {
      map.set(did, resolveVehicleDisplayFromModels(null, { id: did }));
    }
  }

  return map;
}

/**
 * Prefix notification copy with vehicle identity.
 */
export function applyVehicleLabelToNotificationCopy({ title, message }, display) {
  const line = formatVehicleDisplayLine(display);
  if (!line || line === 'Vehicle') {
    return { title, message };
  }
  const titleLower = String(title || '').toLowerCase();
  if (titleLower.includes(line.toLowerCase())) {
    return { title, message };
  }
  return {
    title: `${line}: ${title}`,
    message: String(message || title).includes(line) ? message : `${line} — ${message || title}`,
  };
}

export async function enrichNotificationCopyWithVehicle(deviceId, copy) {
  const display = await getVehicleDisplayByDeviceId(deviceId);
  return applyVehicleLabelToNotificationCopy(copy, display);
}
