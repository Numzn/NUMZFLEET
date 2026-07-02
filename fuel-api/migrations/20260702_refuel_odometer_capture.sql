-- Refuel odometer capture metadata + full-tank flag for fuel intelligence pipeline.

ALTER TABLE operation_session_refuels
  ADD COLUMN IF NOT EXISTS "odometerConfidenceAtCapture" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "odometerResolutionModeAtCapture" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "odometerDriftClassAtCapture" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "isFullTank" BOOLEAN DEFAULT FALSE;
