/**
 * Canonical "awaiting manager review" fuel-request statuses.
 * Mirrors the fuel-api FuelRequest enum so dashboard KPIs and the command-center
 * endpoint count the same thing (avoids the dashboard showing a different number
 * than the server).
 */
export const PENDING_FUEL_STATUSES = ['pending'];

export function isPendingFuelStatus(status) {
  return PENDING_FUEL_STATUSES.includes(String(status || '').toLowerCase());
}
