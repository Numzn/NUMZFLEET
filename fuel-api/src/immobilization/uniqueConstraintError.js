/**
 * Classifies a thrown error as a Postgres unique-violation (23505), however
 * Sequelize happens to have wrapped it. The partial unique index
 * (`vehicle_immobilization_intents_one_active_per_vehicle`) is the authority
 * on "one active intent per vehicle" — this lets callers translate a lost
 * race at the database into the same 409 the app-level pre-check returns,
 * instead of trying to make the pre-check itself atomic.
 *
 * @param {any} error
 * @returns {boolean}
 */
export function isUniqueConstraintError(error) {
  if (!error) return false;
  if (error.name === 'SequelizeUniqueConstraintError') return true;
  const code = error.original?.code || error.parent?.code;
  return code === '23505';
}
