import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const CURSOR_KEY = 'telemetry_reconciliation';

/** Separate cursor from the notification bridge's — this job reads independently and must not perturb it. */
export async function getReconciliationCursor() {
  const rows = await sequelize.query(
    'SELECT cursor_value AS cursor FROM notification_bridge_state WHERE key = :key',
    { replacements: { key: CURSOR_KEY }, type: QueryTypes.SELECT },
  );
  const val = rows[0]?.cursor;
  return Number(val) || 0;
}

export async function setReconciliationCursor(cursor) {
  await sequelize.query(
    `INSERT INTO notification_bridge_state (key, cursor_value, updated_at)
     VALUES (:key, :cursor, NOW())
     ON CONFLICT (key) DO UPDATE SET cursor_value = :cursor, updated_at = NOW()`,
    { replacements: { key: CURSOR_KEY, cursor: Number(cursor) }, type: QueryTypes.UPDATE },
  );
}
