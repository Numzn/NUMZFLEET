import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const BRIDGE_KEY = 'traccar_events';

export async function getBridgeCursor() {
  const rows = await sequelize.query(
    'SELECT cursor_value AS cursor FROM notification_bridge_state WHERE key = :key',
    { replacements: { key: BRIDGE_KEY }, type: QueryTypes.SELECT },
  );
  const val = rows[0]?.cursor;
  return Number(val) || 0;
}

export async function setBridgeCursor(cursor) {
  await sequelize.query(
    `INSERT INTO notification_bridge_state (key, cursor_value, updated_at)
     VALUES (:key, :cursor, NOW())
     ON CONFLICT (key) DO UPDATE SET cursor_value = :cursor, updated_at = NOW()`,
    { replacements: { key: BRIDGE_KEY, cursor: Number(cursor) }, type: QueryTypes.UPDATE },
  );
}
