/**
 * Resolve mileage from Traccar position (odometer → totalDistance), mirroring refuelTelemetryService.
 */
export function resolveMileageFromPosition(position) {
  if (!position) return { mileage: null, mileageSource: null };
  const attrs = position.attributes || {};
  if (attrs.odometer != null && Number.isFinite(Number(attrs.odometer))) {
    return { mileage: Number(attrs.odometer), mileageSource: 'odometer' };
  }
  if (attrs.totalDistance != null && Number.isFinite(Number(attrs.totalDistance))) {
    return { mileage: Number(attrs.totalDistance), mileageSource: 'totalDistance' };
  }
  if (attrs.mileage != null && Number.isFinite(Number(attrs.mileage))) {
    return { mileage: Number(attrs.mileage), mileageSource: 'mileage' };
  }
  return { mileage: null, mileageSource: null };
}

export function resolveMileageFromDeviceState(devicesItems, deviceId, positions) {
  const device = devicesItems?.[deviceId];
  const position = positions?.[deviceId] || device?.position;
  return resolveMileageFromPosition(position);
}

export function validateMileageAgainstPrevious(mileage, previousMileage) {
  if (mileage == null || previousMileage == null) return { valid: true };
  const m = Number(mileage);
  const prev = Number(previousMileage);
  if (!Number.isFinite(m) || !Number.isFinite(prev)) return { valid: true };
  if (m < prev) {
    return {
      valid: false,
      message: `Mileage (${m.toLocaleString()}) is lower than previous (${prev.toLocaleString()}). Provide an override reason.`,
    };
  }
  return { valid: true };
}
