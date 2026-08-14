/**
 * Scope Validation Service
 * 
 * Enforces the three-tier access model:
 * - PLATFORM: Can access all companies
 * - PARTNER: Can access own company + child customer companies
 * - CUSTOMER: Can access own company only
 */

import { Op } from 'sequelize';

/**
 * Determine if user can access a specific company.
 * 
 * Rules:
 * 1. Platform users (activeContext.type === 'platform') can access any company
 * 2. Partner users (activeContext.type === 'partner') can access:
 *    - Their own company (activeContext.companyId)
 *    - All child customer companies (in accessibleCustomerIds)
 * 3. Customer users (activeContext.type === 'customer') can access:
 *    - Only their own company (activeContext.companyId)
 * 
 * @param {Object} auth - req.auth object from attachTenantContext middleware
 * @param {string} requestedCompanyId - The company ID the user is trying to access
 * @returns {boolean} - True if user can access the requested company
 */
export function canAccessCompany(auth, requestedCompanyId) {
  if (!auth?.activeContext) {
    return false;
  }

  const { type, companyId } = auth.activeContext;

  // Platform users can access any company
  if (type === 'platform') {
    return true;
  }

  // Own company is always accessible
  if (companyId === requestedCompanyId) {
    return true;
  }

  // Partner can access child customers
  if (type === 'partner' && auth.accessibleCustomerIds) {
    return auth.accessibleCustomerIds.includes(requestedCompanyId);
  }

  return false;
}

/**
 * Get the list of company IDs accessible to a user.
 * 
 * Used to scope list queries to only show accessible companies.
 * 
 * @param {Object} auth - req.auth object from attachTenantContext middleware
 * @returns {string[]} - Array of company IDs user can access
 */
export function getAccessibleCompanyIds(auth) {
  if (!auth?.activeContext) {
    return [];
  }

  const { type, companyId } = auth.activeContext;

  // Platform has no specific company scope (can access all)
  if (type === 'platform') {
    return null; // null means "all companies"
  }

  // Customer can only access their own company
  if (type === 'customer') {
    return [companyId];
  }

  // Partner can access own company + child customers
  if (type === 'partner') {
    const ids = [companyId];
    if (auth.accessibleCustomerIds) {
      ids.push(...auth.accessibleCustomerIds);
    }
    return ids;
  }

  return [];
}

/**
 * Build a Sequelize WHERE clause to scope queries to accessible companies.
 * 
 * Used in repository methods to automatically filter by accessible companies.
 * 
 * @param {Object} auth - req.auth object
 * @param {string} [companyIdField='companyId'] - The field name to filter on
 * @returns {Object|null} - Sequelize WHERE clause (Op.in), or null for no filtering
 */
export function buildCompanyScopeWhere(auth, companyIdField = 'companyId') {
  const accessibleIds = getAccessibleCompanyIds(auth);

  // Platform users: no company filter (access all)
  if (accessibleIds === null) {
    return null;
  }

  // Customer/Partner: filter to accessible companies
  if (accessibleIds.length === 0) {
    // This shouldn't happen, but safeguard: return impossible condition
    return { [companyIdField]: '00000000-0000-0000-0000-000000000000' };
  }

  if (accessibleIds.length === 1) {
    return { [companyIdField]: accessibleIds[0] };
  }

  return { [companyIdField]: { [Op.in]: accessibleIds } };
}

/**
 * Validate scope and throw an error if user cannot access.
 * 
 * For use in service methods that accept companyId as a parameter.
 * Ensures user cannot bypass scope by passing an unauthorized company ID.
 * 
 * @param {Object} auth - req.auth object
 * @param {string} requestedCompanyId - The company ID to validate
 * @throws {Error} with statusCode 403 if user cannot access
 */
export function validateCompanyScope(auth, requestedCompanyId) {
  if (!canAccessCompany(auth, requestedCompanyId)) {
    const error = new Error('Access denied - You do not have permission to access this company');
    error.statusCode = 403;
    throw error;
  }
}

export default {
  canAccessCompany,
  getAccessibleCompanyIds,
  buildCompanyScopeWhere,
  validateCompanyScope,
};
