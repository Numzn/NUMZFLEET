/**
 * Company Scope Middleware Tests
 * 
 * Verifies that middleware correctly enforces scope on requests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requireCompanyScope } from '../middleware/companyScopeMiddleware.js';

describe('companyScopeMiddleware', () => {
  describe('requireCompanyScope', () => {
    const mockRes = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        return this;
      },
    };

    const nextFn = () => {};

    describe('success cases', () => {
      it('platform user can access any company in params', () => {
        const middleware = requireCompanyScope('params.companyId');
        const req = {
          user: { id: 1 },
          auth: {
            activeContext: {
              type: 'platform',
              companyId: null,
            },
          },
          params: { companyId: 'any-company-uuid' },
        };

        let nextCalled = false;
        middleware(req, mockRes, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, true);
        assert.strictEqual(req.validatedCompanyId, 'any-company-uuid');
      });

      it('partner can access own company in params', () => {
        const middleware = requireCompanyScope('params.companyId');
        const req = {
          user: { id: 1 },
          auth: {
            activeContext: {
              type: 'partner',
              companyId: 'partner-uuid',
            },
            accessibleCustomerIds: ['customer-1', 'customer-2'],
          },
          params: { companyId: 'partner-uuid' },
        };

        let nextCalled = false;
        middleware(req, mockRes, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, true);
        assert.strictEqual(req.validatedCompanyId, 'partner-uuid');
      });

      it('partner can access child customer company in params', () => {
        const middleware = requireCompanyScope('params.companyId');
        const req = {
          user: { id: 1 },
          auth: {
            activeContext: {
              type: 'partner',
              companyId: 'partner-uuid',
            },
            accessibleCustomerIds: ['customer-1', 'customer-2'],
          },
          params: { companyId: 'customer-1' },
        };

        let nextCalled = false;
        middleware(req, mockRes, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, true);
        assert.strictEqual(req.validatedCompanyId, 'customer-1');
      });

      it('customer can access own company in params', () => {
        const middleware = requireCompanyScope('params.companyId');
        const req = {
          user: { id: 1 },
          auth: {
            activeContext: {
              type: 'customer',
              companyId: 'customer-uuid',
            },
            accessibleCustomerIds: [],
          },
          params: { companyId: 'customer-uuid' },
        };

        let nextCalled = false;
        middleware(req, mockRes, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, true);
        assert.strictEqual(req.validatedCompanyId, 'customer-uuid');
      });
    });

    describe('failure cases', () => {
      it('partner cannot access other partner company', () => {
        const middleware = requireCompanyScope('params.companyId');
        const res = { ...mockRes };
        const req = {
          user: { id: 1 },
          auth: {
            activeContext: {
              type: 'partner',
              companyId: 'partner-a-uuid',
            },
            accessibleCustomerIds: ['customer-a1'],
          },
          params: { companyId: 'partner-b-uuid' },
        };

        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(res.body.code, 'COMPANY_ACCESS_DENIED');
      });

      it('customer cannot access other customer company', () => {
        const middleware = requireCompanyScope('params.companyId');
        const res = { ...mockRes };
        const req = {
          user: { id: 1 },
          auth: {
            activeContext: {
              type: 'customer',
              companyId: 'customer-a-uuid',
            },
            accessibleCustomerIds: [],
          },
          params: { companyId: 'customer-b-uuid' },
        };

        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.statusCode, 403);
      });

      it('returns 401 if no user', () => {
        const middleware = requireCompanyScope('params.companyId');
        const res = { ...mockRes };
        const req = {
          user: null,
          params: { companyId: 'company-uuid' },
        };

        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.statusCode, 401);
      });

      it('returns 401 if no activeContext', () => {
        const middleware = requireCompanyScope('params.companyId');
        const res = { ...mockRes };
        const req = {
          user: { id: 1 },
          auth: {},
          params: { companyId: 'company-uuid' },
        };

        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.statusCode, 401);
      });

      it('returns 400 if company ID not in request', () => {
        const middleware = requireCompanyScope('params.companyId');
        const res = { ...mockRes };
        const req = {
          user: { id: 1 },
          auth: {
            activeContext: {
              type: 'platform',
              companyId: null,
            },
          },
          params: {},
        };

        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.statusCode, 400);
      });

      it('supports nested path in request (body.companyId)', () => {
        const middleware = requireCompanyScope('body.companyId');
        const res = { ...mockRes };
        const req = {
          user: { id: 1 },
          auth: {
            activeContext: {
              type: 'customer',
              companyId: 'customer-uuid',
            },
          },
          body: { companyId: 'other-uuid' },
        };

        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.statusCode, 403);
      });
    });
  });
});
