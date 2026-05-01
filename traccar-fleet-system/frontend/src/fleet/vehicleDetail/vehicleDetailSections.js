/** Shared with config panel — single source for type labels. */
export const VEHICLE_TYPES = [
  { value: 'light_duty', label: 'Light duty' },
  { value: 'heavy_duty', label: 'Heavy duty' },
  { value: 'bus', label: 'Bus' },
  { value: 'special', label: 'Special' },
];

export function vehicleTypeLabel(value) {
  const row = VEHICLE_TYPES.find((t) => t.value === value);
  return row?.label || null;
}

/** Section ids for mockup-style tabs (scroll within single unified page). */
export const VEHICLE_DETAIL_SECTIONS = [
  { id: 'vehicle-section-overview', label: 'Overview' },
  { id: 'vehicle-section-fuel', label: 'Fuel planning' },
  { id: 'vehicle-section-map', label: 'Map' },
  { id: 'vehicle-section-alerts', label: 'Alerts' },
  { id: 'vehicle-config-panel', label: 'Setup flow' },
];
