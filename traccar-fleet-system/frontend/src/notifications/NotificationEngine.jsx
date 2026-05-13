import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useToastNotifications } from '../hooks/useToastNotifications';
import { useServiceWorker } from '../hooks/useServiceWorker';
import { selectAllNotifications } from '../store/notifications/notificationSelectors.js';
import { notificationsActions } from '../store/notifications/notificationsSlice.js';
import { isUnifiedNotificationsEnabled } from './notificationFeatureFlags.js';
import { deliverNotification } from './notificationDeliveryService.js';
import { useAttributePreference } from '../common/util/preferences';
import { getDeliveryPlan } from './notificationPriorityService.js';

function useFocusSnapshot() {
  const ref = useRef({ documentHidden: false, hasFocus: true });
  useEffect(() => {
    const sync = () => {
      ref.current = {
        documentHidden: typeof document !== 'undefined' ? document.hidden : false,
        hasFocus: typeof document !== 'undefined' ? document.hasFocus() : true,
      };
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('blur', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('blur', sync);
    };
  }, []);
  return ref;
}

/**
 * Subscribes to centralized notifications and runs delivery (toast / push / sound).
 * Only active when unified notifications flag is on (see notificationFeatureFlags.js).
 */
const NotificationEngine = () => {
  const dispatch = useDispatch();
  const unified = useSelector(isUnifiedNotificationsEnabled);
  const user = useSelector((s) => s.session.user);
  const items = useSelector(selectAllNotifications);
  const focusRef = useFocusSnapshot();

  const soundEvents = useAttributePreference('soundEvents', '');
  const soundAlarms = useAttributePreference('soundAlarms', 'sos');

  const browserNotificationsEnabled = user?.attributes?.browserNotificationsEnabled !== false;

  const { showToast, ToastNotification, showFuelRequestNotification } = useToastNotifications({
    enableBrowserNotifications: browserNotificationsEnabled,
    autoRequestPermission: false,
  });

  const { serviceWorkerReady, showTypedPushNotification } = useServiceWorker();

  const handlers = useMemo(() => ({
    showToast,
    showFuelRequestNotification,
    showTypedPushNotification,
    browserNotificationsEnabled,
    serviceWorkerReady,
  }), [
    showToast,
    showFuelRequestNotification,
    showTypedPushNotification,
    browserNotificationsEnabled,
    serviceWorkerReady,
  ]);

  useEffect(() => {
    if (!user) {
      dispatch(notificationsActions.resetNotifications());
    }
  }, [user, dispatch]);

  const deliveryFingerprint = useMemo(
    () => items.map((n) => `${n.id}:${JSON.stringify(n.metadata?.delivered || {})}:${n.read}:${n.archived}`).join('|'),
    [items],
  );

  const processQueue = useCallback(() => {
    if (!unified) return;
    const focus = focusRef.current;
    const prefs = { soundEvents, soundAlarms };

    items.forEach((n) => {
      if (n.read || n.archived) return;
      const plan = getDeliveryPlan(n.severity, focus);
      const delivered = n.metadata?.delivered || {};
      const needs = (plan.toast && !delivered.toast)
        || (plan.sound && !delivered.sound)
        || (plan.browserPush && !delivered.push && (focus.documentHidden || !focus.hasFocus));
      if (!needs) return;

      deliverNotification(n, {
        handlers,
        focus,
        prefs,
        dispatch,
      });
    });
  }, [unified, items, handlers, soundEvents, soundAlarms, dispatch, focusRef]);

  useEffect(() => {
    processQueue();
  }, [processQueue, deliveryFingerprint, unified]);

  if (!unified) {
    return null;
  }

  return <ToastNotification />;
};

export default NotificationEngine;
