-- Reset all Fueling Day / operation session data (keeps fleet, users, vehicles).
BEGIN;

DELETE FROM operation_adjustments;
DELETE FROM operation_audit_events;
DELETE FROM operation_unlocks;
DELETE FROM operation_session_invoices;
DELETE FROM operation_session_refuels;
DELETE FROM operation_sessions;

COMMIT;

SELECT 'operation_sessions' AS table_name, COUNT(*) AS remaining FROM operation_sessions
UNION ALL SELECT 'operation_session_refuels', COUNT(*) FROM operation_session_refuels
UNION ALL SELECT 'operation_session_invoices', COUNT(*) FROM operation_session_invoices
UNION ALL SELECT 'operation_audit_events', COUNT(*) FROM operation_audit_events;
