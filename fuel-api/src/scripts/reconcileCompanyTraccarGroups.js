/**
 * One-time (re-runnable) reconciliation: for every active company, ensure its
 * Traccar group exists and every active, Traccar-linked numz_users row is
 * granted membership in it — the Traccar-side half of company scoping that
 * ensureDeviceInCompany never covered on its own (Vehicle Visibility Audit,
 * B3 / D1). Additive only: grants Traccar user-group permissions, never
 * revokes any existing tc_user_device / tc_user_group row. Companies whose
 * devices were assigned before this reconciliation existed are exactly the
 * ones this backfills; new assignments stay in sync automatically via
 * assignDevice()'s own call to reconcileCompanyTraccarUsers().
 *
 * This script performs no destructive action and is safe to re-run, but it
 * DOES make live calls to Traccar's admin API for every company/user pair it
 * finds — do not point it at a production database casually. Run it against
 * NumzLab dev first; running it against production is a separate, deliberate
 * decision documented in the Vehicle Visibility Audit (Section E) and is not
 * triggered by this commit.
 *
 * Usage: node src/scripts/reconcileCompanyTraccarGroups.js
 */
import sequelize from '../config/database.js';
import { Company } from '../models/index.js';
import { reconcileCompanyTraccarUsers } from '../services/companyProvisioningService.js';

async function run() {
  await sequelize.authenticate();

  const companies = await Company.findAll({ where: { status: 'active' } });
  let totalGranted = 0;
  let totalChecked = 0;

  for (const company of companies) {
    const result = await reconcileCompanyTraccarUsers(company.id);
    totalChecked += result.usersChecked;
    totalGranted += result.granted;
    console.log(`[${company.slug}] ${result.granted}/${result.usersChecked} Traccar-linked user(s) granted group membership.`);
  }

  console.log(`Reconciliation complete: ${totalGranted}/${totalChecked} user(s) across ${companies.length} compan(y/ies) processed.`);
  await sequelize.close();
}

run().catch(async (error) => {
  console.error('Failed to reconcile company Traccar groups:', error);
  await sequelize.close();
  process.exit(1);
});
