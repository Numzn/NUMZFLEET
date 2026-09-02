-- Fixes a real gap from 20260901_push_subscriptions.sql: on this dev
-- environment, Sequelize's own sync({ alter: true }) (see models/index.js)
-- auto-created the push_subscriptions table from the PushSubscription model
-- BEFORE this migration ran — nodemon restarts on any src/ file save, and
-- the model was saved before the migration was applied. The model didn't
-- declare `unique: true` on endpoint at the time, so the live table ended
-- up without the UNIQUE(endpoint) the original migration intended, making
-- pushSubscriptionsRepository.js's upsertSubscription() (findOrCreate by
-- endpoint) vulnerable to a race producing duplicate rows for one device.
-- A unique index is functionally equivalent to a table constraint here
-- (upsert conflict target, duplicate prevention) and IF NOT EXISTS makes
-- this safe to run whether or not a given environment hit the same race.
-- Idempotent; safe to re-run.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint_unique ON push_subscriptions (endpoint);

COMMIT;
