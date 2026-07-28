import { NotificationPreference } from '../../models/index.js';

export async function listForNumzUser(numzUserId) {
  return NotificationPreference.findAll({ where: { numzUserId } });
}

/**
 * Explicit findOrCreate + conditional update rather than Model.upsert() —
 * the composite (numz_user_id, channel, category) unique constraint isn't
 * declared in the model's own `indexes` option, so Sequelize's ON CONFLICT
 * target inference for upsert() isn't guaranteed correct here. This is more
 * verbose but unambiguous, and the write volume (a few dozen rows, only on
 * explicit save) doesn't need upsert's single-statement performance.
 */
export async function upsertForNumzUser(numzUserId, entries) {
  await Promise.all(entries.map(async (entry) => {
    const [row, created] = await NotificationPreference.findOrCreate({
      where: { numzUserId, channel: entry.channel, category: entry.category },
      defaults: { enabled: entry.enabled },
    });
    if (!created && row.enabled !== entry.enabled) {
      await row.update({ enabled: entry.enabled });
    }
  }));
  return listForNumzUser(numzUserId);
}
