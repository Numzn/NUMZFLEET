import { Company, CompanyDevice, DEFAULT_COMPANY_ID } from '../models/index.js';
import { traccarServiceFetch } from './traccarServiceClient.js';

export async function ensureCompanyTraccarGroup(companyId = DEFAULT_COMPANY_ID) {
  const company = await Company.findByPk(companyId);
  if (!company) {
    const err = new Error('Company not found');
    err.statusCode = 404;
    throw err;
  }
  if (company.traccarGroupId) return company;

  const group = await traccarServiceFetch('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name: `NumzTrak — ${company.name}` }),
  });
  await company.update({ traccarGroupId: group.id });
  return company;
}

export async function ensureDeviceInCompany(companyId, traccarDeviceId, vehicleId = null) {
  const company = await ensureCompanyTraccarGroup(companyId);
  const did = Number(traccarDeviceId);
  if (!Number.isFinite(did)) return;

  const device = await traccarServiceFetch(`/api/devices/${did}`);
  if (device?.groupId !== company.traccarGroupId) {
    await traccarServiceFetch(`/api/devices/${did}`, {
      method: 'PUT',
      body: JSON.stringify({ ...device, groupId: company.traccarGroupId }),
    });
  }

  await CompanyDevice.findOrCreate({
    where: { traccarDeviceId: did },
    defaults: {
      companyId,
      traccarDeviceId: did,
      vehicleId: vehicleId || null,
      isActive: true,
    },
  }).then(async ([row]) => {
    await row.update({
      companyId,
      vehicleId: vehicleId || null,
      isActive: true,
    });
  });
}

export default {
  ensureCompanyTraccarGroup,
  ensureDeviceInCompany,
};
