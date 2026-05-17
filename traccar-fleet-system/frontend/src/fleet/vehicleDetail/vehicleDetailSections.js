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
