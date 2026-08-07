import * as repo from './organizationRepository.js';

function toOrganizationDto(company, memberCount, vehicleCount, deviceCount) {
  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    status: company.status,
    settings: company.settings || {},
    memberCount,
    vehicleCount,
    deviceCount,
    createdAt: company.created_at,
  };
}

async function loadCounts(companyId) {
  const [memberCount, vehicleCount, deviceCount] = await Promise.all([
    repo.countMembers(companyId),
    repo.countVehicles(companyId),
    repo.countActiveDevices(companyId),
  ]);
  return { memberCount, vehicleCount, deviceCount };
}

export async function getOrganization(req) {
  const companyId = req.auth?.companyId;
  if (!companyId) {
    const err = new Error('No organization context');
    err.statusCode = 403;
    throw err;
  }
  const company = await repo.findCompanyById(companyId);
  if (!company) {
    const err = new Error('Organization not found');
    err.statusCode = 404;
    throw err;
  }
  const counts = await loadCounts(companyId);
  return toOrganizationDto(company, counts.memberCount, counts.vehicleCount, counts.deviceCount);
}

export async function patchOrganization(req) {
  const companyId = req.auth?.companyId;
  if (!companyId) {
    const err = new Error('No organization context');
    err.statusCode = 403;
    throw err;
  }
  const body = req.body || {};
  const patch = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      const err = new Error('name cannot be empty');
      err.statusCode = 400;
      throw err;
    }
    patch.name = name;
  }
  if (body.settings !== undefined && typeof body.settings === 'object' && body.settings !== null) {
    patch.settings = body.settings;
  }

  const updated = await repo.updateCompanyFields(companyId, patch);
  if (!updated) {
    const err = new Error('Organization not found');
    err.statusCode = 404;
    throw err;
  }
  const counts = await loadCounts(companyId);
  return toOrganizationDto(updated, counts.memberCount, counts.vehicleCount, counts.deviceCount);
}
