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
 * - GET /api/context (any authenticated user — read-only)
 * - GET /api/platform/overview (NUMZ only)
 * - GET /api/partner/overview (Partner only)
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
  getPartnerOverview,
} from '../services/organizationService.js';
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
 * GET /api/context
 * Read-only projection of req.auth — the identity's activeContext (always
 * their own home company) plus isSuperAdmin/roles/homeCompanyId needed to
 * render navigation. No mutation, no side effects; safe to call on every
 * page load.
 */
export const getContext = async (req, res) => {
  try {
    return res.json({
      activeContext: req.auth?.activeContext ?? null,
      homeCompanyId: req.auth?.homeCompanyId ?? null,
      isSuperAdmin: req.auth?.isSuperAdmin === true,
      roles: req.auth?.roles ?? [],
    });
  } catch (error) {
    return handleError(res, error, 'Get context error', 'Failed to get context');
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

/**
 * GET /api/partner/overview
 * Partner only — the caller's own aggregate statistics
 */
export const getMyOverview = async (req, res) => {
  try {
    const partnerCompanyId = req.auth?.activeContext?.companyId;

    if (!partnerCompanyId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const overview = await getPartnerOverview(partnerCompanyId);
    return res.json(overview);
  } catch (error) {
    return handleError(res, error, 'Get partner overview error', 'Failed to get overview');
  }
};
