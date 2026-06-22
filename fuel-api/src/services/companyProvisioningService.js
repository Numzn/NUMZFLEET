import { Company, CompanyDevice, DEFAULT_COMPANY_ID } from '../models/index.js';

const getTraccarApiBase = () => {
  const raw = process.env.TRACCAR_API_BASE_URL || process.env.TRACCAR_SERVER_URL || process.env.TRACCAR_API_URL || 'http://traccar:8082';
  return raw.replace(/\/$/, '');
};

const getTraccarBasicAuth = () => {
  const user = process.env.TRACCAR_API_USER;
  const password = process.env.TRACCAR_API_PASSWORD;
  if (!user || !password) return null;
  return `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
};

async function traccarServiceFetch(path, init = {}) {
  const base = getTraccarApiBase();
  const auth = getTraccarBasicAuth();
  if (!base || !auth) {
    const err = new Error('Traccar service API not configured');
    err.statusCode = 503;
    throw err;
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: auth,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(text || `Traccar API ${response.status}`);
    err.statusCode = response.status;
    throw err;
  }
  if (response.status === 204) return null;
  return response.json();
}

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
