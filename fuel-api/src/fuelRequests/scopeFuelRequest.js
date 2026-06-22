import { FuelRequest, DEFAULT_COMPANY_ID } from '../models/index.js';

export function resolveCompanyId(req) {
  return req.auth?.companyId || DEFAULT_COMPANY_ID;
}

export async function findFuelRequestScoped(req, id) {
  const companyId = resolveCompanyId(req);
  return FuelRequest.findOne({ where: { id, companyId } });
}

export default { resolveCompanyId, findFuelRequestScoped };
