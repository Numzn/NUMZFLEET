/**
 * One-time backfill: populate locked pricing fields for historical approved/fulfilled
 * FuelRequests that pre-date the locked-pricing feature.
 *
 * Usage (inside the fuel-api Docker container, or locally with correct DATABASE_URL):
 *   node src/scripts/backfillLockedPricing.js
 *
 * Safe to re-run: only rows with NULL lockedApprovedCost are processed (idempotent guard).
 * The script uses the CURRENT ERB price as the best available approximation and tags
 * priceSourceAtApproval = 'backfill' so these rows are clearly distinguishable in audits.
 */

import { syncDatabase, FuelRequest } from '../models/index.js';
import { getLatestErbPrices } from '../reports/adapters/erbAdapter.js';
import { resolveFuelTypeKey } from '../services/fuelPriceSnapshotService.js';
import { Op } from 'sequelize';

const BATCH_SIZE = 50;
const SOURCE_TAG  = 'backfill';
const CURRENCY    = 'ZMW';

async function run() {
  console.log('[backfill] Starting locked-pricing backfill…');

  // ── 1. Fetch current ERB prices once ──────────────────────────────────────
  let erbPrices;
  try {
    const erbResult = await getLatestErbPrices();
    erbPrices = erbResult?.prices ?? {};
    console.log('[backfill] ERB prices fetched:', JSON.stringify(erbPrices));
  } catch (err) {
    console.error('[backfill] Could not fetch ERB prices — aborting.', err?.message || err);
    process.exit(1);
  }

  // ── 2. Connect to DB ──────────────────────────────────────────────────────
  await syncDatabase();

  // ── 3. Find rows that need backfilling ────────────────────────────────────
  const rows = await FuelRequest.findAll({
    where: {
      status: { [Op.in]: ['approved', 'fulfilled'] },
      lockedApprovedCost: { [Op.is]: null },
    },
    order: [['id', 'ASC']],
  });

  if (rows.length === 0) {
    console.log('[backfill] No rows need backfilling — all done.');
    process.exit(0);
  }

  console.log(`[backfill] ${rows.length} rows to backfill…`);

  let updated = 0;
  let skipped = 0;
  const capturedAt = new Date().toISOString();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (row) => {
        const fuelTypeKey = resolveFuelTypeKey(row.lockedFuelType || 'diesel');
        const pricePerUnit = erbPrices[fuelTypeKey] ?? null;

        if (pricePerUnit === null || !Number.isFinite(Number(pricePerUnit))) {
          console.warn(`[backfill] No ERB price for fuelType="${fuelTypeKey}" on row id=${row.id} — skipping`);
          skipped++;
          return;
        }

        const price = Number(pricePerUnit);
        const litres = Number(row.approvedAmount || row.requestedAmount || 0);
        const approvedCost = Number((litres * price).toFixed(2));

        await row.update({
          lockedPricePerUnit:    price,
          lockedCurrency:        CURRENCY,
          lockedFuelType:        fuelTypeKey,
          lockedApprovedCost:    approvedCost,
          priceSourceAtApproval: SOURCE_TAG,
          priceAuditTimestamp:   capturedAt,
        });

        updated++;
      }),
    );

    console.log(`[backfill] Processed ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
  }

  console.log(`[backfill] Done. Updated: ${updated}, Skipped: ${skipped}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
