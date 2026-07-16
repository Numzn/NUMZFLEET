/**
 * Centralizes "how long has this vehicle held its current state" — the one
 * duration calculation every consumer should read from, instead of each
 * recomputing it against a persisted record independently.
 *
 * Mirrors the agreement-gating rule already proven and shipped on the
 * frontend (see resolveLiveActivityState.js consumers such as
 * dashboard/DashboardPage.jsx and main/fleet/VehicleListItem.jsx): a
 * persisted stateEnteredAt is only trustworthy when the persisted record's
 * state still matches the live-resolved state. If they disagree, the
 * transition just happened (or the persisted row is stale/latched — see
 * activityStateService.js) and duration is unknown, not stale-but-close-enough.
 */

/**
 * @param {{
 *   liveState: 'moving'|'idle'|'offline',
 *   persistedState?: { state: string, stateEnteredAt: string|Date, stateSource?: string }|null,
 *   now?: number,
 * }} params
 * @returns {{ enteredAt: string|null, durationSeconds: number|null, agrees: boolean }}
 */
export function calculateDuration({ liveState, persistedState, now = Date.now() }) {
  if (!persistedState || persistedState.state !== liveState || !persistedState.stateEnteredAt) {
    return { enteredAt: null, durationSeconds: null, agrees: false };
  }

  const enteredAtMs = new Date(persistedState.stateEnteredAt).getTime();
  if (!Number.isFinite(enteredAtMs)) {
    return { enteredAt: null, durationSeconds: null, agrees: false };
  }

  return {
    enteredAt: new Date(enteredAtMs).toISOString(),
    durationSeconds: Math.max(0, Math.round((now - enteredAtMs) / 1000)),
    agrees: true,
  };
}
