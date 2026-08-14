-- Partner-Reseller Business Model
-- Adds organization hierarchy: NUMZ Platform → Partner → Customer
-- Backward compatible: existing companies become direct customers (parent_company_id = NULL)
-- Idempotent; safe to re-run.

BEGIN;

-- Add organization type and parent relationship to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS organization_type VARCHAR(20) DEFAULT 'customer';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS parent_company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;

-- Create index for efficient partner → customer queries
CREATE INDEX IF NOT EXISTS idx_companies_parent_company_id ON companies(parent_company_id) WHERE organization_type = 'customer';
CREATE INDEX IF NOT EXISTS idx_companies_organization_type ON companies(organization_type);

-- Partner → Customer explicit relationship table (audit trail, supports future relationship types)
CREATE TABLE IF NOT EXISTS company_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  relationship_type VARCHAR(50) NOT NULL DEFAULT 'managed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID REFERENCES numz_users(id) ON DELETE SET NULL,
  UNIQUE (partner_company_id, customer_company_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_company_relationships_partner ON company_relationships(partner_company_id, status);
CREATE INDEX IF NOT EXISTS idx_company_relationships_customer ON company_relationships(customer_company_id, status);

-- Add comment for clarity
COMMENT ON COLUMN companies.organization_type IS 'Organizational type: "customer" (default, end-user fleet operator), "partner" (reseller, manages customer accounts)';
COMMENT ON COLUMN companies.parent_company_id IS 'For customer orgs: FK to parent partner company. NULL if direct NUMZ customer or if org is a partner. Denormalizes company_relationships for query performance.';
COMMENT ON TABLE company_relationships IS 'Explicit audit trail of Partner → Customer relationships. Mirrors parent_company_id denormalization.';

COMMIT;
