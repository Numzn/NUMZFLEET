import { Company, NumzUser } from '../../models/index.js';
import { createForTraccarUser } from '../profile/profileRepository.js';

const DEFAULT_SETTINGS = {
  timezone: 'Africa/Lusaka',
  currency: 'ZMW',
  fuelUnits: 'litres',
  branding: { logoUrl: null, primaryColor: null },
  features: {
    fleet: true, fuel: true, maintenance: true, expenses: false, erp: false, ai: false,
  },
};

export async function listCompanies() {
  const companies = await Company.findAll({ order: [['created_at', 'DESC']] });
  return Promise.all(companies.map(async (company) => ({
    id: company.id,
    slug: company.slug,
    name: company.name,
    status: company.status,
    memberCount: await NumzUser.count({ where: { companyId: company.id } }),
    createdAt: company.created_at,
  })));
}

export async function findCompanyBySlug(slug) {
  return Company.findOne({ where: { slug } });
}

export async function createCompanyDraft({
  name, slug, contactEmail, contactPhone,
}) {
  return Company.create({
    name,
    slug,
    status: 'provisioning',
    settings: {
      ...DEFAULT_SETTINGS,
      contact: { email: contactEmail || null, phone: contactPhone || null },
    },
  });
}

export async function activateCompany(companyId) {
  const company = await Company.findByPk(companyId);
  if (!company) return null;
  await company.update({ status: 'active' });
  return company;
}

export async function createNumzUserForAdmin({ traccarUserId, email, companyId }) {
  return createForTraccarUser({ traccarUserId, email, companyId });
}
