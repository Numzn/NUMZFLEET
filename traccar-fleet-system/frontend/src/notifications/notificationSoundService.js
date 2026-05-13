import alarm from '../resources/alarm.mp3';

/**
 * Alarm / event sounds (Traccar-style preferences).
 * @param {import('../store/notifications/notificationsSlice.js').NotificationEntity} notification
 * @param {{ soundEvents: string, soundAlarms: string }} prefs
 * @returns {boolean} whether a sound was started
 */
export function playSoundForNotification(notification, prefs) {
  const { soundEvents = '', soundAlarms = 'sos' } = prefs || {};
  const traccarType = notification.metadata?.traccarType;
  if (!traccarType || notification.source !== 'traccar') {
    return false;
  }

  const eventTypes = String(soundEvents)
    .split(/[, ]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const alarmTokens = String(soundAlarms)
    .split(/[, ]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const alarmAttr = notification.metadata?.alarmAttr;
  const shouldPlay = eventTypes.includes(traccarType)
    || (traccarType === 'alarm' && alarmTokens.some((t) => t && alarmAttr && String(alarmAttr).includes(t)));

  if (!shouldPlay) {
    return false;
  }

  try {
    const audio = new Audio(alarm);
    const p = audio.play();
    if (p !== undefined) {
      p.catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Notification sound playback failed:', err);
        }
      });
    }
    return true;
  } catch (e) {
    console.warn('Notification sound error:', e);
    return false;
  }
}

/**
 * Optional warning haptic / beep for non-Traccar severity (policy: engine may call for warning fuel).
 */
export function playWarningChime() {
  try {
    const audio = new Audio(alarm);
    audio.volume = 0.35;
    const p = audio.play();
    if (p !== undefined) p.catch(() => {});
  } catch {
    /* noop */
  }
}
