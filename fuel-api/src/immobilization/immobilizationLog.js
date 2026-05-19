/**
 * Structured logs for immobilization execution governance.
 */

export function logImmobilization(event, fields = {}) {
  const payload = { event, ...fields, ts: new Date().toISOString() };
  console.log(JSON.stringify(payload));
}
