import { saveAs } from 'file-saver';
import { getVehicleLabel } from '../vehicleRegistry/vehicleRegistryUtils.js';

const COLUMNS = [
  ['Date', (row) => (row.date ? new Date(row.date).toISOString() : '')],
  ['Litres', (row) => (row.litres != null ? row.litres.toFixed(1) : '')],
  ['Odometer (km)', (row) => (row.odometerKm != null ? row.odometerKm : '')],
  ['Distance Since Last Refuel (km)', (row) => (row.distanceSinceLastKm != null ? row.distanceSinceLastKm.toFixed(0) : '')],
  ['Fuel Price (ZMW/L)', (row) => (row.pricePerLitre != null ? row.pricePerLitre.toFixed(2) : '')],
  ['Total Cost (ZMW)', (row) => (row.totalCost != null ? row.totalCost.toFixed(2) : '')],
  ['Calculated Economy (km/L)', (row) => (row.economyKmPerL != null ? row.economyKmPerL.toFixed(2) : '')],
  ['Status', (row) => row.status || ''],
];

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Builds and downloads a CSV of a vehicle's fueling history for analysis
 * outside NUMZFLEET. Only surfaces columns the data model actually stores
 * per refuel — driver name and fuel station are not currently captured on
 * the refuel record, so they're intentionally omitted rather than faked.
 */
export function exportVehicleFuelHistoryCsv({ vehicle, history }) {
  const headerRow = COLUMNS.map(([label]) => csvEscape(label)).join(',');
  const dataRows = (history || []).map((row) => COLUMNS.map(([, get]) => csvEscape(get(row))).join(','));
  const csv = [headerRow, ...dataRows].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const safeName = (getVehicleLabel(vehicle) || 'vehicle').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  saveAs(blob, `fuel-history-${safeName}.csv`);
}
