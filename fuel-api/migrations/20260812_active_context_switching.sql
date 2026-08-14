-- Phase 2D: Real Active-Context Switching
-- Separates USER IDENTITY (who authenticated) from ACTIVE CONTEXT (which
-- organization they are currently operating in). Persists the active-context
-- override per Traccar user so it survives across requests (not just a
-- client-side Redux label).
-- Idempotent; safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS active_contexts (
  traccar_user_id INTEGER PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE active_contexts IS 'Per-Traccar-user active organization context override (Phase 2D identity/active-context separation). Row absence = default context (platform for super-admins, home company otherwise).';
COMMENT ON COLUMN active_contexts.company_id IS 'NULL means explicit platform context (super-admin only). Non-null = the partner or customer company currently being operated in.';

COMMIT;
