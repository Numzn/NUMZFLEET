import { getLatestErbPrices } from '../reports/adapters/erbAdapter.js';

const DEFAULT_FUEL_TYPE = 'diesel';
const PRICE_TTL_MS = Number(process.env.OPS_ERB_PRICE_CACHE_TTL_MS || 120000);

const priceCache = new Map();

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
 * Resolve per-litre ERB prices for the given fuel types (defaults to diesel +
 * petrol). Returns a plain map keyed by the normalized fuel type with a
 * `priceFor(rawFuelType)` helper that falls back to diesel.
 */
export async function getErbPriceMap(fuelTypes = ['diesel', 'petrol']) {
  const keys = [...new Set(fuelTypes.map((t) => resolveFuelTypeKey(t)))];
  const entries = await Promise.all(
    keys.map(async (key) => [key, (await getLatestErbPrice(key)).pricePerLitre ?? null]),
  );
  const map = Object.fromEntries(entries);
  return {
    prices: map,
    priceFor(rawFuelType) {
      const key = resolveFuelTypeKey(rawFuelType);
      return map[key] ?? map.diesel ?? null;
    },
  };
}

export async function getLatestErbPrice(fuelType) {
  const resolved = resolveFuelTypeKey(fuelType);
  const cached = priceCache.get(resolved);

  if (cached && (Date.now() - cached.timestamp) < PRICE_TTL_MS) {
    return cached.data;
  }

  try {
    const payload = await getLatestErbPrices();
    const parsed = Number(payload?.prices?.[resolved]);
    const pricePerLitre = Number.isFinite(parsed) ? parsed : null;
    const data = {
      available: pricePerLitre != null,
      pricePerLitre,
      source: 'erb-latest',
      fuelType: resolved,
      capturedAt: new Date().toISOString(),
    };
    priceCache.set(resolved, { timestamp: Date.now(), data });
    return data;
  } catch (error) {
    return {
      available: false,
      pricePerLitre: null,
      source: 'unavailable',
      fuelType: resolved,
      capturedAt: new Date().toISOString(),
    };
  }
}
