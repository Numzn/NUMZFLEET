-- User notifications (fuel-api PostgreSQL)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  type VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'system',
  severity VARCHAR(16) NOT NULL DEFAULT 'info',
  title VARCHAR(512) NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  source VARCHAR(32) NOT NULL DEFAULT 'fuel-api',
  metadata JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  viewed_at TIMESTAMPTZ NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  client_dedup_key VARCHAR(512) NULL,
  tenant_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, read);

CREATE INDEX IF NOT EXISTS idx_notifications_metadata_gin
  ON notifications USING GIN (metadata);
