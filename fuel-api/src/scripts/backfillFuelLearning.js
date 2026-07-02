#!/usr/bin/env node
/**
 * One-time backfill: replay completed refuels through fuel learning pipeline.
 * Idempotent — skips refuels that already have interval rows.
 */
import { DeviceAssignment } from '../models/index.js';
import { findCompletedRefuelsByVehicleId } from '../repositories/operationSessionRefuelRepository.js';
import { processFuelLearningOnRefuelComplete } from '../vehicleEngine/fuel/fuelLearningService.js';

async function main() {
  const assignments = await DeviceAssignment.findAll({
    where: { isActive: true },
    attributes: ['vehicleId', 'deviceId'],
  });

  let processed = 0;
  let skipped = 0;

  for (const assignment of assignments) {
    const deviceId = Number(assignment.deviceId);
    const fleetVehicleId = assignment.vehicleId;
    const refuels = await findCompletedRefuelsByVehicleId(deviceId, 100);
    const sorted = [...refuels].sort(
      (a, b) => new Date(a.sessionDate || a.createdAt) - new Date(b.sessionDate || b.createdAt),
    );

    for (const refuel of sorted) {
      const result = await processFuelLearningOnRefuelComplete({
        refuel,
        fleetVehicleId,
        deviceId,
      });
      if (result?.interval) processed += 1;
      else skipped += 1;
    }
  }

  console.log(`Backfill complete. intervals=${processed} skipped=${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
