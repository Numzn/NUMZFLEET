/**
 * Layer 2 — what this vehicle supports (derived from registry + hub facts).
 * No capability framework; booleans only so UIs can show/hide features.
 */
export function buildCapabilities(registry, hub) {
  const deviceId = registry?.assignment?.deviceId ?? null;
  const telemetry = hub?.telemetry?.telemetry ?? null;
  const fuel = hub?.fuel ?? {};

  const hasFuelSpec = Boolean(
    registry?.vehicleSpec?.fuelEfficiency != null
    || registry?.vehicleSpec?.tankCapacity != null,
  );

  return {
    gps: deviceId != null,
    fuel: Boolean(
      fuel.measured
      || hasFuelSpec
      || fuel.tankLevelPct != null
      || fuel.lastRefuel != null,
    ),
    maintenance: deviceId != null,
    temperatureSensor: telemetry?.coolantC != null,
    canBus: telemetry?.rpm != null || telemetry?.engineLoadPct != null,
  };
}
