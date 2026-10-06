/**
 * Pure logic behind the Devices table (DevicesSection.jsx) — kept free of React
 * and of any app imports so it can be unit-tested with `node --test`.
 *
 * The point of this module is to keep three different questions apart that the
 * old list collapsed into one "group" label:
 *   - telemetry:  is the tracker reporting?     -> classifyDevice()
 *   - assignment: is it on a vehicle?           -> buildAssignmentIndex()
 *   - ownership:  which company holds it?       -> intentionally not shown; the
 *                 signed-in company is implicit on every row.
 */

export const DEVICE_STATES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  NEVER: 'never',
};

export const DEVICE_TABS = ['all', 'online', 'offline', 'never', 'unassigned'];

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Traccar reports `status: 'offline'` both for a tracker that went quiet and for
 * one that has never connected at all. Those need different action from the
 * owner (check the vehicle vs. check power / SIM / server settings), so they are
 * separated here: "never" means no signal has ever been recorded.
 */
export const classifyDevice = (device) => {
  if (device?.status === 'online') return DEVICE_STATES.ONLINE;
  // Traccar's Device.positionId is a primitive long, so "no position yet" arrives
  // over the REST API as 0, not null — treat every falsy value as "none".
  const neverReported = !device?.lastUpdate && !device?.positionId;
  return neverReported ? DEVICE_STATES.NEVER : DEVICE_STATES.OFFLINE;
};

/**
 * deviceId -> the vehicle it is currently assigned to, from the company-scoped
 * vehicles list (each vehicle carries its active `assignment`, or null).
 */
export const buildAssignmentIndex = (vehicles) => {
  const index = new Map();
  (Array.isArray(vehicles) ? vehicles : []).forEach((vehicle) => {
    const deviceId = vehicle?.assignment?.deviceId;
    if (deviceId == null) return;
    index.set(Number(deviceId), {
      vehicleId: vehicle.id,
      name: vehicle.name || 'Unnamed vehicle',
      plateNumber: vehicle.plateNumber || null,
      assignedAt: vehicle.assignment.assignedAt || null,
    });
  });
  return index;
};

/** Devices + their derived telemetry state and (if known) assigned vehicle. */
export const decorateDevices = (devices, assignmentIndex) => (
  (Array.isArray(devices) ? devices : []).map((device) => ({
    ...device,
    state: classifyDevice(device),
    vehicle: assignmentIndex ? (assignmentIndex.get(Number(device.id)) || null) : null,
  }))
);

/**
 * Tab badge counts. `unassigned` is null when the vehicle list could not be
 * loaded (e.g. a non-manager account): without assignment data it would read
 * "everything is unassigned", which is worse than showing nothing.
 */
export const countTabs = (rows, vehiclesKnown) => ({
  all: rows.length,
  online: rows.filter((row) => row.state === DEVICE_STATES.ONLINE).length,
  offline: rows.filter((row) => row.state === DEVICE_STATES.OFFLINE).length,
  never: rows.filter((row) => row.state === DEVICE_STATES.NEVER).length,
  unassigned: vehiclesKnown ? rows.filter((row) => !row.vehicle).length : null,
});

const matchesTab = (row, tab) => {
  switch (tab) {
    case DEVICE_STATES.ONLINE:
    case DEVICE_STATES.OFFLINE:
    case DEVICE_STATES.NEVER:
      return row.state === tab;
    case 'unassigned':
      return !row.vehicle;
    default:
      return true;
  }
};

const searchText = (row) => [
  row.name,
  row.uniqueId,
  row.model,
  row.phone,
  row.contact,
  row.vehicle?.name,
  row.vehicle?.plateNumber,
].filter(Boolean).join(' ').toLowerCase();

export const filterRows = (rows, { tab = 'all', keyword = '' } = {}) => {
  const needle = String(keyword).trim().toLowerCase();
  return rows.filter((row) => matchesTab(row, tab) && (!needle || searchText(row).includes(needle)));
};

/** 1-based paging that clamps an out-of-range page (e.g. after a delete). */
export const paginate = (rows, page, pageSize) => {
  const size = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const start = (safePage - 1) * size;
  return {
    items: rows.slice(start, start + size),
    page: safePage,
    pageCount,
    total,
    from: total ? start + 1 : 0,
    to: Math.min(total, start + size),
  };
};

// Spreadsheet apps execute cells that start with = + - @ as formulas. Device and
// vehicle names are user-controlled, so neutralise them before they land in a CSV.
const neutraliseFormula = (text) => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);

export const csvCell = (value) => {
  if (value == null) return '';
  const text = neutraliseFormula(String(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** `records` is an array of objects sharing the same keys (the column labels). */
export const toCsv = (records) => {
  if (!records.length) return '';
  const header = Object.keys(records[0]);
  const lines = [header.map(csvCell).join(',')];
  records.forEach((record) => lines.push(header.map((key) => csvCell(record[key])).join(',')));
  return `${lines.join('\r\n')}\r\n`;
};
