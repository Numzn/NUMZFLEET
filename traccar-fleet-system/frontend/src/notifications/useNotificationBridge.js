import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectAllNotifications } from '../store/notifications/notificationSelectors.js';

/**
 * Calls onMatch(n) for each notification.created entry that arrives after
 * mount and satisfies predicate(n). Notifications already in the store when
 * the hook first mounts (hydrated history) are marked seen without firing,
 * so page load doesn't retrigger on old notifications.
 */
export default function useNotificationBridge(predicate, onMatch) {
  const notifications = useSelector(selectAllNotifications);
  const seenIds = useRef(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      notifications.forEach((n) => seenIds.current.add(n.id));
      initialized.current = true;
      return;
    }
    notifications.forEach((n) => {
      if (seenIds.current.has(n.id)) return;
      seenIds.current.add(n.id);
      if (predicate(n)) onMatch(n);
    });
  }, [notifications, predicate, onMatch]);
}
