import {
  Company, NumzUser, Vehicle, CompanyDevice,
} from '../../models/index.js';

export async function findCompanyById(companyId) {
  if (!companyId) return null;
  return Company.findByPk(companyId);
}

export async function countMembers(companyId) {
  return NumzUser.count({ where: { companyId } });
}

export async function countVehicles(companyId) {
  return Vehicle.count({ where: { companyId } });
}

export async function countActiveDevices(companyId) {
  return CompanyDevice.count({ where: { companyId, isActive: true } });
}

export async function updateCompanyFields(companyId, fields) {
  const row = await Company.findByPk(companyId);
  if (!row) return null;
  await row.update(fields);
  return row.reload();
}
