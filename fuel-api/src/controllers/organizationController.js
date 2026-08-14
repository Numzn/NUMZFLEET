/**
 * Organization Controller — Partner & Customer Management
 *
 * Endpoints:
 * - POST /api/partners (NUMZ only)
 * - POST /api/direct-customers (NUMZ only)
 * - POST /api/partners/:partnerId/customers (NUMZ only)
 * - GET /api/partners (NUMZ only)
 * - GET /api/direct-customers (NUMZ only)
 * - GET /api/my-customers (Partner only)
 * - POST /api/my-customers (Partner only)
 * - POST /api/context/switch/:companyId (NUMZ admin only)
 * - GET /api/platform/overview (NUMZ only)
 *
 * Phase 2 consolidation (Stage 2, controller wiring): the four create
 * handlers pass an optional `req.body.admin` through to organizationService.js,
 * which has been able to provision a real, login-capable admin since Stage 2
 * landed at the service layer — this file just wasn't forwarding the field.
 * See organizationController.test.js.
 */

import {
  createPartner,
  createDirectCustomer,
  createCustomerUnderPartner,
  listPartners,
  listDirectCustomers,
  listPartnerCustomers,
  getOrganizationOverview,
} from '../services/organizationService.js';
import { switchActiveContext, resetActiveContext } from '../services/tenantResolverService.js';
import { handleError } from '../utils/handleError.js';

/**
 * POST /api/partners
 * NUMZ only — Create a new Partner organization
 */
export const createPartnerOrg = async (req, res) => {
  try {
    const {
      name, slug, traccarGroupId, admin,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const partner = await createPartner({
      name,
      slug,
      traccarGroupId,
      admin,
      createdByUserId: req.user?.id,
    });

    return res.status(201).json(partner);
  } catch (error) {
    return handleError(res, error, 'Create partner error', 'Failed to create partner');
  }
};

/**
 * POST /api/direct-customers
 * NUMZ only — Create a Direct Customer (no parent Partner)
 */
export const createDirectCustomerOrg = async (req, res) => {
  try {
    const {
      name, slug, traccarGroupId, admin,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const customer = await createDirectCustomer({
      name,
      slug,
      traccarGroupId,
      admin,
      createdByUserId: req.user?.id,
    });

    return res.status(201).json(customer);
  } catch (error) {
    return handleError(res, error, 'Create direct customer error', 'Failed to create direct customer');
  }
};

/**
 * POST /api/partners/:partnerId/customers
 * NUMZ only — Create a Customer under a specific Partner
 */
export const createCustomerUnderPartnerOrg = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const {
      name, slug, traccarGroupId, admin,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const customer = await createCustomerUnderPartner({
      partnerId,
      name,
      slug,
      traccarGroupId,
      admin,
      createdByUserId: req.user?.id,
    });

    return res.status(201).json(customer);
  } catch (error) {
    return handleError(res, error, 'Create customer under partner error', 'Failed to create customer');
  }
};

/**
 * GET /api/partners
 * NUMZ only — List all Partners
 */
export const listPartnersOrg = async (req, res) => {
  try {
    const partners = await listPartners();
    return res.json(partners);
  } catch (error) {
    return handleError(res, error, 'List partners error', 'Failed to list partners');
  }
};

/**
 * GET /api/direct-customers
 * NUMZ only — List all Direct Customers (parentCompanyId IS NULL)
 */
export const listDirectCustomersOrg = async (req, res) => {
  try {
    const customers = await listDirectCustomers();
    return res.json(customers);
  } catch (error) {
    return handleError(res, error, 'List direct customers error', 'Failed to list direct customers');
  }
};

/**
 * GET /api/my-customers
 * Partner only — List Customers under this Partner
 */
export const listMyCustomers = async (req, res) => {
  try {
    const partnerCompanyId = req.auth?.activeContext?.companyId;
    
    if (!partnerCompanyId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const customers = await listPartnerCustomers(partnerCompanyId);
    return res.json(customers);
  } catch (error) {
    return handleError(res, error, 'List my customers error', 'Failed to list customers');
  }
};

/**
 * POST /api/my-customers
 * Partner only — Create a Customer under this Partner
 */
export const createMyCustomer = async (req, res) => {
  try {
    const partnerCompanyId = req.auth?.activeContext?.companyId;
    const {
      name, slug, traccarGroupId, admin,
    } = req.body || {};

    if (!partnerCompanyId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const customer = await createCustomerUnderPartner({
      partnerId: partnerCompanyId,
      name,
      slug,
      traccarGroupId,
      admin,
      createdByUserId: req.user?.id,
    });

    return res.status(201).json(customer);
  } catch (error) {
    return handleError(res, error, 'Create my customer error', 'Failed to create customer');
  }
};

/**
 * POST /api/context/switch/:companyId
 * Switch the caller's ACTIVE CONTEXT to another organization. Authorization is
 * enforced server-side by switchActiveContext (identity-aware — platform can
 * switch anywhere, a partner only into itself or its own customers, a customer
 * nowhere else) — the companyId param is never trusted as authorization by
 * itself. The override is persisted (active_contexts table) so it is
 * recognized by every subsequent request, not just reflected in the response.
 */
export const switchContext = async (req, res) => {
  try {
    const { companyId } = req.params;

    const newContext = await switchActiveContext(req.user, companyId);

    // Audit trail
    console.log(`[AUDIT] Traccar user ${req.user?.id} switched active context to ${newContext.type} (${newContext.companyId || 'platform'})`);

    return res.json({ switched: true, ...newContext });
  } catch (error) {
    return handleError(res, error, 'Switch context error', 'Failed to switch context');
  }
};

/**
 * POST /api/context/reset
 * Reset the caller's ACTIVE CONTEXT back to their default (home) context —
 * platform for a super admin, their own company otherwise. Does not require a
 * browser reload; this is the backend-supported "back to platform"/"back to
 * home" path.
 */
export const resetContext = async (req, res) => {
  try {
    const newContext = await resetActiveContext(req.user);

    console.log(`[AUDIT] Traccar user ${req.user?.id} reset active context to ${newContext.type} (${newContext.companyId || 'platform'})`);

    return res.json({ switched: true, ...newContext });
  } catch (error) {
    return handleError(res, error, 'Reset context error', 'Failed to reset context');
  }
};

/**
 * GET /api/platform/overview
 * NUMZ only — Platform-level aggregate statistics
 */
export const getPlatformOverview = async (req, res) => {
  try {
    const overview = await getOrganizationOverview();
    return res.json(overview);
  } catch (error) {
    return handleError(res, error, 'Get platform overview error', 'Failed to get overview');
  }
};
