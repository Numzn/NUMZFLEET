import sequelize from '../config/database.js';
import { OperationSession, OperationSessionRefuel } from '../models/index.js';

async function run() {
  const userId = Number(process.env.SEED_USER_ID || 1);
  const now = new Date();

  await sequelize.authenticate();

  const session = await OperationSession.create({
    userId,
    name: `Seed Operation Session ${now.toISOString().slice(0, 10)}`,
    sessionDate: now,
    notes: 'Seeded demo data for operation sessions',
    status: 'active',
    totalEstimatedFuel: 68,
    totalActualFuel: 64,
    totalEstimatedCost: 2412,
    totalActualCost: 2272,
    totalVarianceCost: -140,
  });

  await OperationSessionRefuel.bulkCreate([
    {
      sessionId: session.id,
      userId,
      vehicleId: 101,
      fuelCost: 1136,
      fuelAmount: 32,
      estimatedFuelLitres: 34,
      actualFuelLitres: 32,
      varianceLitres: -2,
      variancePercent: -5.88,
      status: 'warning',
      erbPricePerLitre: 35.5,
      estimatedCost: 1207,
      actualCost: 1136,
      tankLevelStart: 0.22,
      tankCapacitySnapshot: 90,
      currentMileage: 221340,
      sessionDate: now,
    },
    {
      sessionId: session.id,
      userId,
      vehicleId: 205,
      fuelCost: 1136,
      fuelAmount: 32,
      estimatedFuelLitres: 34,
      actualFuelLitres: 32,
      varianceLitres: -2,
      variancePercent: -5.88,
      status: 'warning',
      erbPricePerLitre: 35.5,
      estimatedCost: 1207,
      actualCost: 1136,
      tankLevelStart: 0.18,
      tankCapacitySnapshot: 80,
      currentMileage: 145970,
      sessionDate: now,
    },
  ]);

  console.log(`Seeded operation session ${session.id} for user ${userId}`);
  await sequelize.close();
}

run().catch(async (error) => {
  console.error('Failed to seed operation session demo:', error);
  await sequelize.close();
  process.exit(1);
});
