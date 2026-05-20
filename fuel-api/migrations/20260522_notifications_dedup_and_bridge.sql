-- Notification dedup + Traccar bridge cursor state

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedup
  ON notifications (user_id, client_dedup_key)
  WHERE client_dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_since
  ON notifications (user_id, created_at ASC)
  WHERE archived = false;

CREATE TABLE IF NOT EXISTS notification_bridge_state (
  key VARCHAR(64) PRIMARY KEY,
  cursor_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO notification_bridge_state (key, cursor_value)
VALUES ('traccar_events', 0)
ON CONFLICT (key) DO NOTHING;
