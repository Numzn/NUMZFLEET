-- Explicit operator fill classification for trusted refuel evidence (Increment 4).
-- FULL | PARTIAL | UNKNOWN — default UNKNOWN; do not infer from isFullTank=false.

ALTER TABLE operation_session_refuels
  ADD COLUMN IF NOT EXISTS fill_classification VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN';
