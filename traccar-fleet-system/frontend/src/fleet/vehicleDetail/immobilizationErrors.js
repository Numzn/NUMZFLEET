/**
 * Stable executionError codes from fuel-api → operator-facing copy.
 */
const EXECUTION_ERROR_MESSAGES = {
  claim_timeout:
    'Command delivery did not finish in time. Check command history on the device before sending a new request.',
  device_reassigned:
    'The tracker assignment changed before the command could be sent. Create a new request after confirming the correct device.',
  traccar_http_rejected:
    'The tracking server rejected the command. Check device connectivity and command support.',
  claim_lost_race:
    'Another process handled this request. Refresh the page to see the current status.',
  reconciled_complete:
    'Delivery was recovered automatically after an interruption.',
};

export function formatExecutionError(code) {
  if (!code) return null;
  return EXECUTION_ERROR_MESSAGES[code] || code.replace(/_/g, ' ');
}

export function formatDeliveryPhase(phase) {
  const labels = {
    claimed: 'Claimed for delivery',
    http_accepted: 'Accepted by tracking server',
    http_rejected: 'Rejected by tracking server',
    delivery_unknown: 'Delivery outcome unknown',
  };
  return labels[phase] || phase || null;
}
