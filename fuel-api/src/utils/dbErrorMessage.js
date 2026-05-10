/**
 * Sequelize / node-pg errors often put the real Postgres message on `parent` or `original`.
 */
export function dbErrorMessage(error, fallback) {
  const raw =
    error?.message ||
    error?.parent?.message ||
    error?.original?.message ||
    (typeof error?.sql === 'string' ? error.sql : '');
  const s = raw != null ? String(raw).trim() : '';
  return s || fallback;
}
