/**
 * Central registry of Postgres advisory-lock keys used by interval jobs.
 * All lock-using schedulers must pull their key from here so a collision
 * (two jobs silently sharing a key and skipping each other's ticks forever)
 * fails loudly at import time instead of silently in production.
 */
export const LOCK_KEYS = {
  IMMOBILIZATION_EVALUATOR: 84729103,
  TELEMETRY_RECONCILIATION: 84729104,
  VEHICLE_STATE_RECONCILIATION: 84729105,
  DAILY_MILEAGE: 84729106,
};

const values = Object.values(LOCK_KEYS);
if (new Set(values).size !== values.length) {
  throw new Error('Duplicate advisory lock key in jobs/lockKeys.js — pick a unique value for each job');
}
