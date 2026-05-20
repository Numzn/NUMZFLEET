import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isNotificationPersistenceSyncEnabled } from './notificationFeatureFlags.js';
import { runNotificationSync } from './notificationSync.js';

/**
 * Runs incremental notification sync on auth and when transports reconnect.
 */
const NotificationSyncController = () => {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.session.user);
  const persistence = useSelector(isNotificationPersistenceSyncEnabled);
  const ranInitial = useRef(false);

  useEffect(() => {
    if (!user?.id || !persistence) return;
    if (!ranInitial.current) {
      ranInitial.current = true;
      void runNotificationSync(dispatch, user, persistence);
    }
  }, [user, persistence, dispatch]);

  useEffect(() => {
    if (!user?.id || !persistence) return undefined;

    const onReconnect = () => {
      void runNotificationSync(dispatch, user, persistence);
    };

    window.addEventListener('numz:notifications-sync', onReconnect);
    return () => window.removeEventListener('numz:notifications-sync', onReconnect);
  }, [user, persistence, dispatch]);

  return null;
};

export function requestNotificationSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('numz:notifications-sync'));
  }
}

export default NotificationSyncController;
