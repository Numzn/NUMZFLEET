import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

let db;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.logsDir, { recursive: true });
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  const schemaPath = path.join(config.rccRoot, 'db', 'schema.sql');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  return db;
}

export function getLatestOverview() {
  const row = getDb()
    .prepare(
      `SELECT payload_json, collected_at FROM state_snapshots
       WHERE source = 'collector' ORDER BY id DESC LIMIT 1`,
    )
    .get();
  if (!row) return null;
  return { ...JSON.parse(row.payload_json), freshness: { collectedAt: row.collected_at } };
}

export function saveOverview(payload) {
  getDb()
    .prepare(`INSERT INTO state_snapshots (source, payload_json) VALUES ('collector', ?)`)
    .run(JSON.stringify(payload));
}

export function upsertTimelineEvent(event) {
  getDb()
    .prepare(
      `INSERT INTO timeline_events (
        dedupe_key, occurred_at, source, category, severity, title, subtitle,
        git_sha, environment, link_url, entity_type, entity_id, payload_json
      ) VALUES (
        @dedupeKey, @occurredAt, @source, @category, @severity, @title, @subtitle,
        @gitSha, @environment, @linkUrl, @entityType, @entityId, @payloadJson
      )
      ON CONFLICT(dedupe_key) DO UPDATE SET
        occurred_at = excluded.occurred_at,
        severity = excluded.severity,
        title = excluded.title,
        subtitle = excluded.subtitle,
        payload_json = excluded.payload_json`,
    )
    .run({
      dedupeKey: event.dedupeKey,
      occurredAt: event.occurredAt,
      source: event.source,
      category: event.category,
      severity: event.severity,
      title: event.title,
      subtitle: event.subtitle || null,
      gitSha: event.gitSha || null,
      environment: event.environment || null,
      linkUrl: event.linkUrl || null,
      entityType: event.entityType,
      entityId: String(event.entityId),
      payloadJson: JSON.stringify(event.payload || {}),
    });
}

export function listTimeline({ limit = 50, before = null, category = null } = {}) {
  let sql = `SELECT * FROM timeline_events WHERE 1=1`;
  const params = { limit };
  if (before) {
    sql += ` AND occurred_at < @before`;
    params.before = before;
  }
  if (category) {
    sql += ` AND category = @category`;
    params.category = category;
  }
  sql += ` ORDER BY occurred_at DESC LIMIT @limit`;
  return getDb().prepare(sql).all(params).map(rowToTimelineEvent);
}

function rowToTimelineEvent(row) {
  return {
    id: row.id,
    dedupeKey: row.dedupe_key,
    occurredAt: row.occurred_at,
    source: row.source,
    category: row.category,
    severity: row.severity,
    title: row.title,
    subtitle: row.subtitle,
    gitSha: row.git_sha,
    environment: row.environment,
    linkUrl: row.link_url,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: JSON.parse(row.payload_json || '{}'),
  };
}

export function createAuditEntry(entry) {
  const result = getDb()
    .prepare(
      `INSERT INTO audit_log (
        actor, action, target_env, git_sha, status, command, metadata_json, ip_address
      ) VALUES (@actor, @action, @targetEnv, @gitSha, @status, @command, @metadataJson, @ipAddress)`,
    )
    .run({
      actor: entry.actor,
      action: entry.action,
      targetEnv: entry.targetEnv || null,
      gitSha: entry.gitSha || null,
      status: entry.status || 'queued',
      command: entry.command,
      metadataJson: JSON.stringify(entry.metadata || {}),
      ipAddress: entry.ipAddress || null,
    });
  return result.lastInsertRowid;
}

export function updateAuditEntry(id, patch) {
  const fields = [];
  const params = { id };
  for (const [key, val] of Object.entries(patch)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    fields.push(`${col} = @${key}`);
    params[key] = val;
  }
  if (!fields.length) return;
  getDb().prepare(`UPDATE audit_log SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function getAuditEntry(id) {
  return getDb().prepare(`SELECT * FROM audit_log WHERE id = ?`).get(id);
}

export function listAudit({ limit = 50, offset = 0 } = {}) {
  return getDb()
    .prepare(`SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(limit, offset);
}

export function listJobs({ limit = 50 } = {}) {
  return listAudit({ limit, offset: 0 });
}

export function tryAcquireJobLock(jobId) {
  const dbi = getDb();
  const row = dbi.prepare(`SELECT held_by FROM job_lock WHERE id = 1`).get();
  if (row?.held_by != null) return false;
  dbi.prepare(`UPDATE job_lock SET held_by = ?, acquired_at = datetime('now') WHERE id = 1 AND held_by IS NULL`).run(jobId);
  const after = dbi.prepare(`SELECT held_by FROM job_lock WHERE id = 1`).get();
  return after?.held_by === jobId;
}

export function releaseJobLock(jobId) {
  getDb()
    .prepare(`UPDATE job_lock SET held_by = NULL, acquired_at = NULL WHERE id = 1 AND held_by = ?`)
    .run(jobId);
}

export function getActiveJob() {
  return getDb()
    .prepare(`SELECT * FROM audit_log WHERE status IN ('queued', 'running') ORDER BY id DESC LIMIT 1`)
    .get();
}

export function getCursor(name) {
  const row = getDb().prepare(`SELECT cursor_value FROM collector_cursors WHERE collector_name = ?`).get(name);
  return row?.cursor_value || null;
}

export function setCursor(name, value) {
  getDb()
    .prepare(
      `INSERT INTO collector_cursors (collector_name, cursor_value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(collector_name) DO UPDATE SET cursor_value = excluded.cursor_value, updated_at = datetime('now')`,
    )
    .run(name, value);
}
