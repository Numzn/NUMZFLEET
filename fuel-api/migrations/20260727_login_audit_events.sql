-- Minimal login-attempt log for the Settings Center's Security section — NOT
-- the full platform_audit_events system described in docs/PLATFORM_ARCHITECTURE.md
-- (that's a separate, larger initiative). Populated only at the explicit
-- POST /api/auth/login entry point, both success and failure paths.
-- Idempotent; safe to re-run.
BEGIN;

CREATE TABLE IF NOT EXISTS login_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traccar_user_id INTEGER,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  email VARCHAR(255),
  outcome VARCHAR(20) NOT NULL,
  method VARCHAR(20) NOT NULL DEFAULT 'password',
  ip VARCHAR(64),
  user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_audit_events_traccar_user ON login_audit_events (traccar_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_events_email ON login_audit_events (email, occurred_at DESC);

COMMIT;
