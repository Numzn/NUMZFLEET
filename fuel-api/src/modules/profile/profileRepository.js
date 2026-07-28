import { NumzUser } from '../../models/index.js';

export async function findByNumzUserId(numzUserId) {
  if (!numzUserId) return null;
  return NumzUser.findByPk(numzUserId);
}

export async function findByTraccarUserId(traccarUserId) {
  return NumzUser.findOne({ where: { traccarUserId: Number(traccarUserId) } });
}

export async function createForTraccarUser({ traccarUserId, email, companyId }) {
  return NumzUser.create({
    traccarUserId: Number(traccarUserId),
    email,
    companyId: companyId || null,
    status: 'active',
  });
}

export async function updateNumzUserFields(numzUserId, fields) {
  const row = await NumzUser.findByPk(numzUserId);
  if (!row) return null;
  await row.update(fields);
  return row.reload();
}
