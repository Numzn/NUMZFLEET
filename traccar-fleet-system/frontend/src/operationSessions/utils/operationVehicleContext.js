/**
 * Fleet / operation session helpers: device list for quick start from Redux `devices.items`.
 */

const MAX_QUICK_START_VEHICLES = 40;

/**
 * @param {Record<string, object>} devicesMap - e.g. state.devices.items
 * @returns {number[]} Traccar device IDs (used as vehicleId in operation sessions)
 */
export function collectDeviceIdsForQuickStart(devicesMap) {
  if (!devicesMap || typeof devicesMap !== 'object') {
    return [];
  }
  const rows = Object.values(devicesMap).filter(Boolean);
  const ids = rows
    .map((d) => Number(d.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const unique = [...new Set(ids)];
  unique.sort((a, b) => a - b);
  return unique.slice(0, MAX_QUICK_START_VEHICLES);
}
