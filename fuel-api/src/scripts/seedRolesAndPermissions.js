/**
 * Idempotent: syncs src/permissions/permissionCatalog.js into the
 * permissions/roles/role_permissions tables. Safe to re-run — every write is
 * a findOrCreate, so running this after adding a new permission or role to
 * the catalog just inserts what's missing, it never duplicates or wipes
 * existing rows (including any company-specific custom roles created later,
 * which this script never touches — it only manages company_id IS NULL
 * system role templates).
 *
 * Usage: node src/scripts/seedRolesAndPermissions.js
 */
import sequelize from '../config/database.js';
import { Role, Permission, RolePermission } from '../models/index.js';
import { PERMISSIONS, SYSTEM_ROLES } from '../permissions/permissionCatalog.js';

async function run() {
  await sequelize.authenticate();

  const permissionByKey = new Map();
  for (const def of PERMISSIONS) {
    const [permission] = await Permission.findOrCreate({
      where: { key: def.key },
      defaults: { category: def.category, description: def.description || null },
    });
    permissionByKey.set(def.key, permission);
  }
  console.log(`Permissions: ${permissionByKey.size} in catalog, all present in DB.`);

  let roleCount = 0;
  let bundleCount = 0;
  for (const roleDef of SYSTEM_ROLES) {
    const [role] = await Role.findOrCreate({
      where: { key: roleDef.key, companyId: null },
      defaults: { label: roleDef.label, isSystem: true },
    });
    roleCount += 1;

    for (const permissionKey of roleDef.permissions) {
      const permission = permissionByKey.get(permissionKey);
      if (!permission) {
        console.warn(`Role "${roleDef.key}" references unknown permission "${permissionKey}" — skipping.`);
        continue;
      }
      const [, created] = await RolePermission.findOrCreate({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (created) bundleCount += 1;
    }
  }
  console.log(`System roles: ${roleCount} in catalog, all present in DB. ${bundleCount} new role-permission links created.`);

  await sequelize.close();
}

run().catch(async (error) => {
  console.error('Failed to seed roles and permissions:', error);
  await sequelize.close();
  process.exit(1);
});
