import fetchOrThrow from '../common/util/fetchOrThrow.js';
import { fuelApiAuthHeaders } from '../config/fuelApiAuth.js';

/**
 * Organization Management API Calls
 * All calls hit the backend Fuel API endpoints (/api/partners, /api/direct-customers, etc.)
 * These are literal /api/... paths (see FUEL_API_PREFIXES in config/traccarApi.js) —
 * do NOT route them through traccarFetch/traccarPath, which is reserved for Traccar (Java) endpoints.
 *
 * Every function takes the Traccar `user` (from state.session.user) as its first argument
 * so fuelApiAuthHeaders can attach x-user-id, matching the pattern used by
 * settings/center/platformCompaniesApi.js.
 */

export const fetchContext = async (user) => {
  const response = await fetchOrThrow('/api/context', { headers: fuelApiAuthHeaders(user) });
  return response.json();
};

export const fetchPartners = async (user) => {
  const response = await fetchOrThrow('/api/partners', { headers: fuelApiAuthHeaders(user) });
  return response.json();
};

export const fetchDirectCustomers = async (user) => {
  const response = await fetchOrThrow('/api/direct-customers', { headers: fuelApiAuthHeaders(user) });
  return response.json();
};

export const fetchPlatformOverview = async (user) => {
  const response = await fetchOrThrow('/api/platform/overview', { headers: fuelApiAuthHeaders(user) });
  return response.json();
};

export const fetchPartnerOverview = async (user) => {
  const response = await fetchOrThrow('/api/partner/overview', { headers: fuelApiAuthHeaders(user) });
  return response.json();
};

export const createPartner = async (user, data) => {
  const response = await fetchOrThrow('/api/partners', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(data),
  });
  return response.json();
};

export const createDirectCustomer = async (user, data) => {
  const response = await fetchOrThrow('/api/direct-customers', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(data),
  });
  return response.json();
};

export const switchContext = async (user, companyId) => {
  const response = await fetchOrThrow(`/api/context/switch/${companyId}`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
};

export const fetchMyCustomers = async (user) => {
  const response = await fetchOrThrow('/api/my-customers', { headers: fuelApiAuthHeaders(user) });
  return response.json();
};

export const createMyCustomer = async (user, data) => {
  const response = await fetchOrThrow('/api/my-customers', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(data),
  });
  return response.json();
};
