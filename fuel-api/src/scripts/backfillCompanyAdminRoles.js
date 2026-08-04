/**
 * One-time backfill: assign the system "company_admin" role to every
 * numz_users row that belongs to a Traccar administrator, scoped to that
 * user's own company_id — matching what they already effectively have
 * today under the Traccar-flag system, so this backfill changes nothing
 * about what anyone can do (permissions[] isn't gated on anywhere yet).
 * Idempotent — safe to re-run, findOrCreate skips existing assignments.
 *
 * Usage: node src/scripts/backfillCompanyAdminRoles.js
 */
import sequelize from '../config/database.js';
import { NumzUser, Role, UserRole } from '../models/index.js';
import { getTraccarUser } from '../services/userService.js';

async function run() {
  await sequelize.authenticate();

  const companyAdminRole = await Role.findOne({ where: { key: 'company_admin', companyId: null } });
  if (!companyAdminRole) {
    throw new Error('company_admin system role not found — run seedRolesAndPermissions.js first.');
  }

  const numzUsers = await NumzUser.findAll({ where: { status: 'active' } });
  let assigned = 0;
  let skipped = 0;

  for (const numzUser of numzUsers) {
    if (!numzUser.companyId || !numzUser.traccarUserId) {
      skipped += 1;
      continue;
    }
    const traccarUser = await getTraccarUser(numzUser.traccarUserId).catch(() => null);
    if (!traccarUser?.administrator) {
      skipped += 1;
      continue;
    }
    const [, created] = await UserRole.findOrCreate({
      where: { numzUserId: numzUser.id, roleId: companyAdminRole.id, companyId: numzUser.companyId },
    });
    if (created) assigned += 1;
  }

  console.log(`Backfill complete: ${assigned} new company_admin assignment(s), ${skipped} user(s) skipped (not an administrator or unprovisioned).`);
  await sequelize.close();
}

run().catch(async (error) => {
  console.error('Failed to backfill company_admin roles:', error);
  await sequelize.close();
  process.exit(1);
});
