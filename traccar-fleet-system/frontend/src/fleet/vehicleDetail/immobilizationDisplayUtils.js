/** User-facing text for immobilization capability blocked-reason codes. */
const BLOCKED_REASON_MESSAGES = {
  no_device_assignment: 'No tracker is assigned to this vehicle.',
  traccar_command_api_not_configured: 'Remote commands are not configured on this server.',
  traccar_service_account_auth_failed:
    'Remote command API is configured, but the service account could not sign in. Confirm the NUMZFLEET System user exists in Traccar with the password in backend/.env.',
  capability_check_failed: 'Remote command API is configured, but capability check failed. Try again or check tracker connectivity.',
  protocol_unsupported: 'Remote command API configured. This tracker does not support engine stop or resume.',
};

const PROTOCOL_REASON_MESSAGES = {
  no_engine_stop: 'Engine stop is not available for this tracker protocol.',
  no_engine_resume: 'Engine resume is not available for this tracker protocol.',
  custom_only: 'Only custom commands are available; standard engine stop/resume are not supported.',
};

export function formatImmobilizationBlockedReason(code) {
  if (!code || typeof code !== 'string') return null;
  return BLOCKED_REASON_MESSAGES[code] || code.replace(/_/g, ' ');
}

export function formatProtocolReason(code) {
  if (!code || typeof code !== 'string') return null;
  return PROTOCOL_REASON_MESSAGES[code] || null;
}

/**
 * Normalize capabilities API payload for UI (setup + immobilizer).
 * @param {object|null|undefined} caps
 */
export function describeImmobilizationCapabilities(caps) {
  if (!caps) {
    return { mode: 'unknown', summary: null, detail: null, showChips: false };
  }

  if (caps.blockedReason === 'no_device_assignment') {
    return {
      mode: 'no_device',
      summary: formatImmobilizationBlockedReason(caps.blockedReason),
      detail: null,
      showChips: false,
    };
  }

  if (
    caps.commandApiConfigured === false
    || caps.blockedReason === 'traccar_command_api_not_configured'
  ) {
    return {
      mode: 'api_not_configured',
      summary: formatImmobilizationBlockedReason('traccar_command_api_not_configured'),
      detail: null,
      showChips: false,
    };
  }

  if (caps.blockedReason === 'traccar_service_account_auth_failed') {
    return {
      mode: 'auth_failed',
      summary: formatImmobilizationBlockedReason('traccar_service_account_auth_failed'),
      detail: null,
      showChips: false,
    };
  }

  if (caps.blockedReason === 'capability_check_failed') {
    return {
      mode: 'check_failed',
      summary: formatImmobilizationBlockedReason('capability_check_failed'),
      detail: caps.capabilityCheckError || null,
      showChips: false,
    };
  }

  if (caps.commandApiConfigured && caps.blockedReason === 'protocol_unsupported') {
    const parts = [
      formatProtocolReason(caps.immobilizeReason),
      formatProtocolReason(caps.mobilizeReason),
    ].filter(Boolean);
    return {
      mode: 'protocol_unsupported',
      summary: formatImmobilizationBlockedReason('protocol_unsupported'),
      detail: parts.length ? parts.join(' ') : null,
      showChips: true,
    };
  }

  return {
    mode: 'ready',
    summary: 'Remote command API configured',
    detail: null,
    showChips: true,
  };
}

/** Setup module readiness label/detail from capabilities. */
export function setupSafetyReadinessFromCapabilities(caps) {
  const d = describeImmobilizationCapabilities(caps);
  if (d.mode === 'api_not_configured' || d.mode === 'auth_failed') {
    return { status: 'recommended', label: 'Immobilization limited', detail: d.summary };
  }
  if (d.mode === 'no_device' || d.mode === 'check_failed') {
    return { status: 'recommended', label: 'Immobilization limited', detail: d.summary };
  }
  if (d.mode === 'protocol_unsupported') {
    return {
      status: 'recommended',
      label: 'Tracker does not support immobilization',
      detail: d.detail || d.summary,
    };
  }
  if (d.mode === 'ready' && (caps?.canImmobilize || caps?.canMobilize)) {
    return {
      status: 'complete',
      label: 'Immobilization available',
      detail: [
        caps.canImmobilize ? 'Engine stop supported' : null,
        caps.canMobilize ? 'Engine resume supported' : null,
      ].filter(Boolean).join(' · ') || d.summary,
    };
  }
  return { status: 'recommended', label: 'Immobilization limited', detail: d.summary };
}
