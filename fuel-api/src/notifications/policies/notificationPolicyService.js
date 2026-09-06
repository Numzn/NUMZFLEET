/**
 * Central notification behavior registry for Traccar tracking events.
 * Aligns with frontend vehicleAlertUtils for map/ops display (not bell ingest).
 *
 * Keeps its own signature (it decides from raw external event data, unlike the
 * keyword-argument policies in notificationPolicyRegistry.js) but speaks the
 * same vocabulary: CHANNELS/SEVERITY/URGENCY. It previously returned
 * 'bell'/'push'/'sms' strings, a second representation of the same concepts
 * that trackingNotificationService.js had to translate at the call site.
 * 'bell' meant in-app, which is the inbox row plus the socket emit — exactly
 * IN_APP_CHANNELS.
 */

import { CHANNELS, IN_APP_CHANNELS, URGENCY } from '../contracts/notificationContract.js';

const GEOFENCE_ALARM_TYPES = new Set(['geofenceenter', 'geofenceexit', 'geofence']);
const CRITICAL_TYPES = new Set(['panic', 'sos', 'emergency', 'fault']);
const WARNING_PERSIST_TYPES = new Set([
  'geofenceenter',
  'geofenceexit',
  'overspeed',
  'maintenance',
  'fueldrop',
]);
const SKIP_TYPES = new Set(['deviceonline', 'deviceoffline', 'devicemoving', 'devicestopped']);

// The two channel sets this registry emits, named once. ALERT_CHANNELS is the
// escalated set used for genuine security events (restricted-geofence breach,
// alarms, panic/SOS) — in-app plus the two out-of-band channels.
const ALERT_CHANNELS = Object.freeze([...IN_APP_CHANNELS, CHANNELS.PUSH, CHANNELS.SMS]);

function parseAttributes(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : {};
    } catch {
      return {};
    }
  }
  return {};
}

function resolveEventType(type, attributes) {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'geofenceenter' || t === 'tracking.geofence.entered') return 'geofenceEnter';
  if (t === 'geofenceexit' || t === 'tracking.geofence.exited') return 'geofenceExit';
  if (t === 'deviceoverspeed') return 'overspeed';
  if (t === 'alarm') {
    const alarm = String(attributes?.alarm || '').toLowerCase();
    if (alarm === 'geofenceenter') return 'geofenceEnter';
    if (alarm === 'geofenceexit') return 'geofenceExit';
    if (GEOFENCE_ALARM_TYPES.has(alarm)) return 'geofenceEnter';
  }
  return type?.trim?.() || 'unknown';
}

function isGeofenceEvent(resolvedType, attributes) {
  const t = String(resolvedType || '').toLowerCase();
  if (t === 'geofenceenter' || t === 'geofenceexit') return true;
  if (t === 'alarm') {
    return GEOFENCE_ALARM_TYPES.has(String(attributes?.alarm || '').toLowerCase());
  }
  return false;
}

/**
 * @param {{ type?: string, attributes?: object }} traccarEvent
 * @returns {{
 *   persist: boolean,
 *   ingestClient: boolean,
 *   severity: string,
 *   urgency: string,
 *   category: string,
 *   notificationType: string,
 *   resolvedType: string,
 *   channels: string[],
 * }} `channels` are CHANNELS enum values, ready to pass straight to
 *   publishNotification() — no call-site translation needed.
 */
/**
 * @param {{ type?: string, attributes?: object }} traccarEvent
 * @param {{ isRestrictedGeofence?: boolean }} [context] `isRestrictedGeofence`
 *   is resolved by the caller (an async DB lookup — see geofenceConfigLookup.js)
 *   and passed in already-resolved, keeping this function pure/sync. Only
 *   affects geofence enter/exit; ignored for every other event type.
 */
export function resolveTraccarTrackingPolicy(traccarEvent, context = {}) {
  const attrs = parseAttributes(traccarEvent?.attributes);
  const resolvedType = resolveEventType(traccarEvent?.type, attrs);
  const rawLower = String(traccarEvent?.type || '').toLowerCase();
  const resolvedLower = String(resolvedType || '').toLowerCase();

  if (SKIP_TYPES.has(rawLower) || SKIP_TYPES.has(resolvedLower)) {
    return {
      persist: false,
      ingestClient: false,
      severity: 'info',
      urgency: URGENCY.NORMAL,
      category: 'tracking',
      notificationType: `traccar.${resolvedType}`,
      resolvedType,
      channels: [],
    };
  }

  if (isGeofenceEvent(resolvedType, attrs)) {
    const isExit = resolvedLower.includes('exit');
    const restricted = Boolean(context?.isRestrictedGeofence);
    return {
      persist: true,
      ingestClient: true,
      severity: restricted ? 'critical' : 'warning',
      // A restricted-zone breach is happening now and a vehicle is moving;
      // an ordinary geofence crossing is a movement record.
      urgency: restricted ? URGENCY.IMMEDIATE : URGENCY.NORMAL,
      category: restricted ? 'security' : 'tracking',
      notificationType: isExit ? 'tracking.geofence.exited' : 'tracking.geofence.entered',
      resolvedType,
      channels: restricted ? ALERT_CHANNELS : IN_APP_CHANNELS,
    };
  }

  if (rawLower === 'alarm' || resolvedLower === 'alarm') {
    const alarm = String(attrs.alarm || '').toLowerCase();
    if (GEOFENCE_ALARM_TYPES.has(alarm)) {
      const isExit = alarm.includes('exit');
      return {
        persist: true,
        ingestClient: true,
        severity: 'warning',
        urgency: URGENCY.NORMAL,
        category: 'tracking',
        notificationType: isExit ? 'tracking.geofence.exited' : 'tracking.geofence.entered',
        resolvedType,
        channels: IN_APP_CHANNELS,
      };
    }
    return {
      persist: true,
      ingestClient: true,
      severity: 'critical',
      urgency: URGENCY.IMMEDIATE,
      category: 'security',
      notificationType: 'tracking.alarm',
      resolvedType,
      channels: ALERT_CHANNELS,
    };
  }

  if (CRITICAL_TYPES.has(resolvedLower) || CRITICAL_TYPES.has(rawLower)) {
    return {
      persist: true,
      ingestClient: true,
      severity: 'critical',
      // panic / SOS / emergency / fault — someone or something needs help now.
      urgency: URGENCY.IMMEDIATE,
      category: 'security',
      notificationType: `tracking.${resolvedLower}`,
      resolvedType,
      channels: ALERT_CHANNELS,
    };
  }

  if (WARNING_PERSIST_TYPES.has(resolvedLower) || resolvedLower.includes('overspeed')) {
    return {
      persist: true,
      ingestClient: true,
      severity: 'warning',
      urgency: URGENCY.NORMAL,
      category: resolvedLower === 'maintenance' ? 'maintenance' : 'tracking',
      notificationType: `tracking.${resolvedLower}`,
      resolvedType,
      channels: IN_APP_CHANNELS,
    };
  }

  return {
    persist: false,
    ingestClient: true,
    severity: 'info',
    urgency: URGENCY.NORMAL,
    category: 'tracking',
    notificationType: `traccar.${resolvedType}`,
    resolvedType,
    channels: [],
  };
}

/**
 * Build inbox title/message for a Traccar event row.
 * @param {{ type?: string, attributes?: object, deviceid?: number }} row
 * @param {{ resolvedType: string, notificationType: string }} policy
 */
export function buildTraccarNotificationCopy(row, policy) {
  const attrs = parseAttributes(row?.attributes);
  const msg = attrs.message != null ? String(attrs.message) : '';
  const resolved = policy.resolvedType || row?.type || 'Event';
  const title = resolved.replace(/([A-Z])/g, ' $1').trim() || policy.notificationType;
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    message: msg || title,
  };
}

/**
 * Stable dedup key aligned with frontend metadata.dedupKey
 */
export function traccarClientDedupKey(eventId, userId) {
  return `${userId}:traccar:${eventId}`;
}

export function traccarSharedDedupKey(eventId) {
  return `traccar:${eventId}`;
}
