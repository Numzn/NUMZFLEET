/** User-facing text for setup/API blocked-reason codes (no product names). */
export function formatSetupBlockedReason(code) {
  if (!code || typeof code !== 'string') return null;
  const map = {
    traccar_command_api_not_configured: 'Remote commands are not configured on this server.',
  };
  return map[code] || code.replace(/_/g, ' ');
}
