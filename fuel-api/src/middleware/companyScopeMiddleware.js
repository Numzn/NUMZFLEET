/**
 * Company Scope Enforcement Middleware
 * 
 * Validates that the user has access to the company specified in the route
 * before the controller even runs.
 */

import { canAccessCompany } from '../services/scopeValidationService.js';
import { Company } from '../models/index.js';

/**
 * Middleware factory to validate company scope.
 * 
 * Usage:
 *   router.get('/:companyId/details', requireCompanyScope('params.companyId'), controller)
 * 
 * @param {string} companyIdPath - Path to company ID in request (e.g., 'params.companyId', 'body.companyId')
 * @returns {Function} - Middleware function
 */
export function requireCompanyScope(companyIdPath = 'params.companyId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.auth?.activeContext) {
      return res.status(401).json({ error: 'Invalid tenant context' });
    }

    // Extract company ID from request
    const parts = companyIdPath.split('.');
    let companyId = req;
    for (const part of parts) {
      companyId = companyId?.[part];
    }

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    // Check if user can access this company
    if (!canAccessCompany(req.auth, companyId)) {
      return res.status(403).json({
        error: 'Forbidden - You do not have access to this company',
        code: 'COMPANY_ACCESS_DENIED',
      });
    }

    // Store the validated company ID for use in the route
    req.validatedCompanyId = companyId;
    next();
  };
}

/**
 * Middleware to validate that a company exists before allowing access.
 * 
 * Runs after requireCompanyScope.
 * 
 * Usage:
 *   router.get('/:companyId/details', requireCompanyScope(), requireCompanyExists(), controller)
 */
export function requireCompanyExists() {
  return async (req, res, next) => {
    const companyId = req.validatedCompanyId || req.params.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      const company = await Company.findByPk(companyId, {
        attributes: ['id', 'name', 'organizationType', 'status'],
      });
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }
      if (company.status !== 'active') {
        return res.status(410).json({ error: 'Company is not active' });
      }

      // Store company for use in route
      req.company = company;
      next();
    } catch (error) {
      console.error('[requireCompanyExists] Error:', error.message);
      return res.status(500).json({ error: 'Failed to validate company' });
    }
  };
}

export default {
  requireCompanyScope,
  requireCompanyExists,
};
