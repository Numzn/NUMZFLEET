/**
 * Resolves the current unit price for a given fuel type from the ERB API.
 *
 * Returns a snapshot object that is safe to write directly onto a FuelRequest
 * as locked pricing fields.  If the ERB API is unavailable the function
 * returns a null-snapshot and logs a warning — it deliberately does NOT throw
 * so that an ERB outage never blocks an approval transition.
 *
 * @param {'petrol'|'diesel'|'kerosene'|'jetA1'} fuelType
 * @returns {Promise<PriceSnapshot>}
 *
 * @typedef {Object} PriceSnapshot
 * @property {number|null}  pricePerUnit        — unit price in local currency
 * @property {string}       currency            — ISO 4217 code (always 'ZMW')
 * @property {string}       fuelType            — resolved fuel type key
 * @property {number|null}  approvedCost        — pricePerUnit × approvedLitres (null if price unavailable)
 * @property {string}       source              — 'erb-latest' | 'unavailable'
 * @property {string}       capturedAt          — ISO 8601 timestamp
 */

import { getLatestErbPrices } from '../reports/adapters/erbAdapter.js';

const DEFAULT_FUEL_TYPE = 'diesel';

/**
 * Derive a canonical fuel type key from the vehicle's fuelType field or
 * the request body.  Falls back to 'diesel' if the value is unrecognised.
 */
export function resolveFuelTypeKey(rawFuelType) {
  const map = {
    petrol: 'petrol',
    gasoline: 'petrol',
    diesel: 'diesel',
    kerosene: 'kerosene',
    jeta1: 'jetA1',
    'jet a-1': 'jetA1',
    'jet a1': 'jetA1',
  };
  const key = String(rawFuelType ?? '').toLowerCase().trim();
  return map[key] ?? DEFAULT_FUEL_TYPE;
}

/**
 * Capture the current ERB price for `fuelType` and compute approved cost.
 *
 * @param {number}  approvedLitres
 * @param {string}  [fuelType]       — raw fuel type string from vehicle/request
 * @returns {Promise<PriceSnapshot>}
 */
export async function captureApprovalPriceSnapshot(approvedLitres, fuelType) {
  const capturedAt = new Date().toISOString();
  const resolvedType = resolveFuelTypeKey(fuelType);

  try {
    const erbResult = await getLatestErbPrices();
    const pricePerUnit = erbResult?.prices?.[resolvedType] ?? null;

    if (pricePerUnit === null || !Number.isFinite(Number(pricePerUnit))) {
      console.warn(
        `[fuelPriceSnapshot] ERB returned no price for fuelType="${resolvedType}"; snapshot will be null`,
      );
      return _nullSnapshot(resolvedType, capturedAt);
    }

    const price = Number(pricePerUnit);
    return {
      pricePerUnit: price,
      currency: 'ZMW',
      fuelType: resolvedType,
      approvedCost: Number((approvedLitres * price).toFixed(2)),
      source: 'erb-latest',
      capturedAt,
    };
  } catch (err) {
    console.warn(
      `[fuelPriceSnapshot] ERB unavailable during approval snapshot: ${err?.message || err}`,
    );
    return _nullSnapshot(resolvedType, capturedAt);
  }
}

function _nullSnapshot(fuelType, capturedAt) {
  return {
    pricePerUnit: null,
    currency: 'ZMW',
    fuelType,
    approvedCost: null,
    source: 'unavailable',
    capturedAt,
  };
}
