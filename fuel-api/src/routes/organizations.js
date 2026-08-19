/**
 * Organization Routes — Partner & Customer Management
 *
 * Authorization:
 * - NUMZ platform (administrator=true, companyId=null) only for most endpoints
 * - Partner users can only manage own customers
 * - Customers cannot create anything
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { attachTenantContext } from '../middleware/tenantContext.js';
import { requireAuth, requirePlatformOwner, requirePartner } from '../middleware/authGates.js';
import {
  createPartnerOrg,
  createDirectCustomerOrg,
  createCustomerUnderPartnerOrg,
  listPartnersOrg,
  listDirectCustomersOrg,
  listMyCustomers,
  createMyCustomer,
  switchContext,
  resetContext,
  getContext,
  getPlatformOverview,
  getMyOverview,
} from '../controllers/organizationController.js';

const router = express.Router();

/**
 * Platform-only routes
 * Require: authenticate → attachTenantContext → platform check
 */

// POST /api/partners — Create Partner
router.post(
  '/partners',
  authenticate,
  attachTenantContext,
  requirePlatformOwner,
  createPartnerOrg
);

// POST /api/direct-customers — Create Direct Customer
router.post(
  '/direct-customers',
  authenticate,
  attachTenantContext,
  requirePlatformOwner,
  createDirectCustomerOrg
);

// POST /api/partners/:partnerId/customers — Create Customer under Partner
router.post(
  '/partners/:partnerId/customers',
  authenticate,
  attachTenantContext,
  requirePlatformOwner,
  createCustomerUnderPartnerOrg
);

// GET /api/partners — List all Partners
router.get(
  '/partners',
  authenticate,
  attachTenantContext,
  requirePlatformOwner,
  listPartnersOrg
);

// GET /api/direct-customers — List Direct Customers
router.get(
  '/direct-customers',
  authenticate,
  attachTenantContext,
  requirePlatformOwner,
  listDirectCustomersOrg
);

// GET /api/platform/overview — Platform aggregate statistics
router.get(
  '/platform/overview',
  authenticate,
  attachTenantContext,
  requirePlatformOwner,
  getPlatformOverview
);

// GET /api/context — Read-only projection of the caller's current context.
// No mutation; safe to call on every page load. Any authenticated user may
// read their own context.
router.get(
  '/context',
  authenticate,
  attachTenantContext,
  requireAuth,
  getContext
);

// POST /api/context/switch/:companyId — Switch active context. Authorization is
// enforced inside switchActiveContext (identity-aware: platform can switch
// anywhere, a partner only into itself or its own customers, a customer
// nowhere else) — NOT gated to platform owners only, since partners must be
// able to switch into their own customers too (see Phase 2D).
router.post(
  '/context/switch/:companyId',
  authenticate,
  attachTenantContext,
  requireAuth,
  switchContext
);

// POST /api/context/reset — Explicitly return to the caller's default (home)
// context — platform for a super admin, their own company otherwise. Does not
// require a browser reload.
router.post(
  '/context/reset',
  authenticate,
  attachTenantContext,
  requireAuth,
  resetContext
);

/**
 * Partner-only routes
 * Require: authenticate → attachTenantContext → partner check
 */

// GET /api/my-customers — Partner lists own customers
router.get(
  '/my-customers',
  authenticate,
  attachTenantContext,
  requireAuth,
  requirePartner,
  listMyCustomers
);

// GET /api/partner/overview — Partner's own aggregate statistics
router.get(
  '/partner/overview',
  authenticate,
  attachTenantContext,
  requireAuth,
  requirePartner,
  getMyOverview
);

// POST /api/my-customers — Partner creates own customer
router.post(
  '/my-customers',
  authenticate,
  attachTenantContext,
  requireAuth,
  requirePartner,
  createMyCustomer
);

export default router;
