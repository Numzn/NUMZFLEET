/**
 * Operational Safety Contract — single source of truth for immobilization gates.
 * All speed thresholds use km/h; Traccar position.speed is converted from knots once.
 */

export const KNOTS_TO_KMH = 1.852;

export const DEFAULT_SAFETY_CONFIG = {
  maxSpeedKmh: 5,
  safeSpeedDurationSec: 10,
  connectionStableSec: 15,
  telemetryFreshSec: 30,
  maxFixLagSec: 60,
  intentTtlMin: 15,
};

export const IMMOBILIZE_ACTION = 'immobilize';
export const MOBILIZE_ACTION = 'mobilize';

/**
 * @param {number|null|undefined} speedKnots Traccar position.speed
 * @returns {number|null}
 */
export function speedKnotsToKmh(speedKnots) {
  if (speedKnots == null || speedKnots === '') return null;
  const n = Number(speedKnots);
  if (!Number.isFinite(n)) return null;
  return n * KNOTS_TO_KMH;
}

/**
 * @param {Date|string|number|null} value
 * @returns {number|null} epoch ms
 */
export function toEpochMs(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Build evaluator snapshot from Traccar device + position rows.
 * @param {{ status?: string, lastupdate?: Date|string }} device
 * @param {{ speed?: number, servertime?: Date|string, fixtime?: Date|string, attributes?: object }|null} position
 * @param {number} [nowMs]
 */
export function buildTelemetrySnapshot(device, position, nowMs = Date.now()) {
  const online = String(device?.status || '').toLowerCase() === 'online';
  const speedKmh = speedKnotsToKmh(position?.speed);
  const serverTimeMs = toEpochMs(position?.servertime);
  const fixTimeMs = toEpochMs(position?.fixtime);
  const attrs = position?.attributes && typeof position.attributes === 'object'
    ? position.attributes
    : {};

  return {
    nowMs,
    online,
    speedKmh,
    serverTimeMs,
    fixTimeMs,
    attributes: attrs,
  };
}

/**
 * @param {object} snapshot from buildTelemetrySnapshot
 * @param {object} config merged DEFAULT_SAFETY_CONFIG
 * @returns {{ fresh: boolean, fixLagOk: boolean, ageSec: number|null, reason: string|null }}
 */
export function assessTelemetryFreshness(snapshot, config) {
  const { nowMs, serverTimeMs, fixTimeMs } = snapshot;
  const refMs = serverTimeMs ?? fixTimeMs;
  if (refMs == null) {
    return { fresh: false, fixLagOk: false, ageSec: null, reason: 'no_telemetry' };
  }
  const ageSec = (nowMs - refMs) / 1000;
  const fresh = ageSec >= 0 && ageSec <= config.telemetryFreshSec;

  let fixLagOk = true;
  if (serverTimeMs != null && fixTimeMs != null) {
    const lagSec = (serverTimeMs - fixTimeMs) / 1000;
    fixLagOk = lagSec >= 0 && lagSec <= config.maxFixLagSec;
  }

  let reason = null;
  if (!fresh) reason = 'stale_telemetry';
  else if (!fixLagOk) reason = 'buffered_position';

  return { fresh: fresh && fixLagOk, fixLagOk, ageSec, reason };
}

/**
 * Evaluate safety gates for an intent action.
 *
 * @param {object} params
 * @param {'immobilize'|'mobilize'} params.action
 * @param {ReturnType<buildTelemetrySnapshot>} params.snapshot
 * @param {{ safeSpeedSince?: number|null, onlineSince?: number|null }} params.timerState prior gateSnapshot.timerState
 * @param {Partial<typeof DEFAULT_SAFETY_CONFIG>} [params.config]
 * @returns {object} gate evaluation result for persistence + UI
 */
export function evaluateGates({
  action,
  snapshot,
  timerState = {},
  config: configOverrides = {},
}) {
  const config = { ...DEFAULT_SAFETY_CONFIG, ...configOverrides };
  const { nowMs, online, speedKmh } = snapshot;
  const freshness = assessTelemetryFreshness(snapshot, config);

  const speedOk = speedKmh == null ? false : speedKmh <= config.maxSpeedKmh;
  const speedHigh = speedKmh != null && speedKmh > config.maxSpeedKmh;

  let safeSpeedSince = timerState.safeSpeedSince ?? null;
  let onlineSince = timerState.onlineSince ?? null;

  const speedConditionMet = online && freshness.fresh && speedOk;
  const connectionConditionMet = online && freshness.fresh;

  if (speedConditionMet) {
    if (safeSpeedSince == null) safeSpeedSince = nowMs;
  } else {
    safeSpeedSince = null;
  }

  if (connectionConditionMet) {
    if (onlineSince == null) onlineSince = nowMs;
  } else {
    onlineSince = null;
  }

  const safeSpeedElapsedSec = safeSpeedSince != null
    ? Math.max(0, (nowMs - safeSpeedSince) / 1000)
    : 0;
  const connectionStableElapsedSec = onlineSince != null
    ? Math.max(0, (nowMs - onlineSince) / 1000)
    : 0;

  const gates = {
    online: { pass: online, label: 'Tracker online' },
    telemetryFresh: { pass: freshness.fresh, label: 'Fresh telemetry', reason: freshness.reason },
    speedWithinLimit: {
      pass: speedOk,
      label: `Speed at or below ${config.maxSpeedKmh} km/h`,
      speedKmh: speedKmh != null ? Math.round(speedKmh * 10) / 10 : null,
    },
    safeSpeedMaintained: {
      pass: safeSpeedElapsedSec >= config.safeSpeedDurationSec,
      label: `Low speed maintained ${config.safeSpeedDurationSec}s`,
      elapsedSec: Math.round(safeSpeedElapsedSec * 10) / 10,
      requiredSec: config.safeSpeedDurationSec,
    },
    connectionStable: {
      pass: connectionStableElapsedSec >= config.connectionStableSec,
      label: `Stable connection ${config.connectionStableSec}s`,
      elapsedSec: Math.round(connectionStableElapsedSec * 10) / 10,
      requiredSec: config.connectionStableSec,
    },
  };

  const reasons = [];
  if (!online) reasons.push('device_offline');
  if (!freshness.fresh) reasons.push(freshness.reason || 'stale_telemetry');
  if (action === IMMOBILIZE_ACTION && speedHigh) reasons.push('speed_too_high');
  if (action === IMMOBILIZE_ACTION && !speedOk && speedKmh != null) reasons.push('speed_unknown_or_high');

  let authorized = false;
  if (action === MOBILIZE_ACTION) {
    authorized = online && freshness.fresh;
    if (!authorized && reasons.length === 0) {
      if (!online) reasons.push('device_offline');
      if (!freshness.fresh) reasons.push(freshness.reason || 'stale_telemetry');
    }
  } else {
    authorized =
      online
      && freshness.fresh
      && speedOk
      && safeSpeedElapsedSec >= config.safeSpeedDurationSec
      && connectionStableElapsedSec >= config.connectionStableSec;
  }

  return {
    action,
    authorized,
    gates,
    reasons,
    telemetry: {
      speedKmh: speedKmh != null ? Math.round(speedKmh * 10) / 10 : null,
      telemetryAgeSec: freshness.ageSec != null ? Math.round(freshness.ageSec * 10) / 10 : null,
      online,
    },
    timerState: {
      safeSpeedSince,
      onlineSince,
    },
    timers: {
      safeSpeedElapsedSec: Math.round(safeSpeedElapsedSec * 10) / 10,
      connectionStableElapsedSec: Math.round(connectionStableElapsedSec * 10) / 10,
    },
  };
}

export function intentExpiresAt(nowMs = Date.now(), config = DEFAULT_SAFETY_CONFIG) {
  return new Date(nowMs + config.intentTtlMin * 60 * 1000);
}
