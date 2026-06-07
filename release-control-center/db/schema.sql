-- NUMZFLEET Release Control Center — SQLite schema

CREATE TABLE IF NOT EXISTS audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at     TEXT NOT NULL DEFAULT (datetime('now')),
  actor           TEXT NOT NULL DEFAULT 'system',
  action          TEXT NOT NULL,
  target_env      TEXT,
  git_sha         TEXT,
  status          TEXT NOT NULL DEFAULT 'queued',
  exit_code       INTEGER,
  command         TEXT NOT NULL,
  stdout_path     TEXT,
  stderr_path     TEXT,
  metadata_json   TEXT DEFAULT '{}',
  ip_address      TEXT,
  duration_ms     INTEGER,
  finished_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_occurred ON audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_status ON audit_log (status);

CREATE TABLE IF NOT EXISTS state_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  collected_at    TEXT NOT NULL DEFAULT (datetime('now')),
  source          TEXT NOT NULL DEFAULT 'collector',
  payload_json    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_state_snapshots_time ON state_snapshots (collected_at DESC);

CREATE TABLE IF NOT EXISTS timeline_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupe_key      TEXT NOT NULL UNIQUE,
  occurred_at     TEXT NOT NULL,
  source          TEXT NOT NULL,
  category        TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'info',
  title           TEXT NOT NULL,
  subtitle        TEXT,
  git_sha         TEXT,
  environment     TEXT,
  link_url        TEXT,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  payload_json    TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_timeline_occurred ON timeline_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_sha ON timeline_events (git_sha);

CREATE TABLE IF NOT EXISTS collector_cursors (
  collector_name  TEXT PRIMARY KEY,
  cursor_value    TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_lock (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  held_by         INTEGER,
  acquired_at     TEXT
);

INSERT OR IGNORE INTO job_lock (id, held_by, acquired_at) VALUES (1, NULL, NULL);
