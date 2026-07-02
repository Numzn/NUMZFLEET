import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectAllNotifications } from '../../store/notifications/notificationSelectors.js';

/**
 * Tracking notifications for a vehicle workspace, preferring the centralized inbox.
 */
export default function useVehicleTrackingNotifications(deviceId, legacyAlerts = []) {
  const all = useSelector(selectAllNotifications);

  return useMemo(() => {
    const fromInbox = all
      .filter((n) => !n.archived && n.category === 'tracking')
      .filter((n) => {
        const metaDevice = n.metadata?.deviceId;
        return metaDevice != null && deviceId != null && Number(metaDevice) === Number(deviceId);
      })
      .map((n) => ({
        id: n.id,
        severity: n.severity || 'info',
        message: n.title || n.message,
        type: n.metadata?.traccarType || n.type || 'tracking',
        time: n.timestamp,
        source: 'notification',
      }));

    if (fromInbox.length > 0) {
      return fromInbox.slice(0, 12);
    }

    return legacyAlerts.slice(0, 12).map((a) => ({
      id: a.id,
      severity: a.severity || 'info',
      message: a.message || a.type,
      type: a.type,
      time: a.eventTime || a.serverTime,
      source: 'traccar',
    }));
  }, [all, deviceId, legacyAlerts]);
}
