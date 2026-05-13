import { snackBarDurationLongMs } from '../common/util/duration';
import {
  getDeliveryPlan,
  mapSeverityToToastType,
} from './notificationPriorityService.js';
import { shouldSkipDedup } from './notificationDedupService.js';
import { playSoundForNotification, playWarningChime } from './notificationSoundService.js';
import { notificationsActions } from '../store/notifications/notificationsSlice.js';

/**
 * @typedef {object} DeliveryHandlers
 * @property {(msg: string, type?: string, duration?: number, opts?: object) => unknown} showToast
 * @property {(kind: string, data: object) => unknown} [showFuelRequestNotification]
 * @property {(title: string, type: string, opts?: object) => unknown} [showTypedPushNotification]
 * @property {boolean} browserNotificationsEnabled
 * @property {boolean} serviceWorkerReady
 */

/**
 * @param {import('../store/notifications/notificationsSlice.js').NotificationEntity} notification
 * @param {object} ctx
 * @param {DeliveryHandlers} ctx.handlers
 * @param {{ documentHidden: boolean, hasFocus: boolean }} ctx.focus
 * @param {{ soundEvents: string, soundAlarms: string }} ctx.prefs
 * @param {(a: import('@reduxjs/toolkit').AnyAction) => void} ctx.dispatch
 */
export function deliverNotification(notification, ctx) {
  const { handlers, focus, prefs, dispatch } = ctx;
  if (!notification || notification.read || notification.archived) return;

  const dedupKey = notification.metadata?.dedupKey || notification.id;
  const plan = getDeliveryPlan(notification.severity, focus);
  const delivered = { ...(notification.metadata?.delivered || {}) };

  if (plan.sound && !delivered.sound) {
    if (shouldSkipDedup(`sound:${dedupKey}`)) {
      dispatch(notificationsActions.markChannelDelivered({ id: notification.id, channel: 'sound' }));
    } else if (notification.source === 'traccar') {
      playSoundForNotification(notification, prefs);
      dispatch(notificationsActions.markChannelDelivered({ id: notification.id, channel: 'sound' }));
    } else if (notification.severity === 'critical' && notification.category === 'fuel') {
      playWarningChime();
      dispatch(notificationsActions.markChannelDelivered({ id: notification.id, channel: 'sound' }));
    }
  }

  if (plan.toast && handlers.showToast && !delivered.toast) {
    const toastType = mapSeverityToToastType(notification.severity);
    const duration = plan.persistentToast ? snackBarDurationLongMs * 4 : snackBarDurationLongMs;
    const skipPush = !plan.browserPush || !handlers.browserNotificationsEnabled;
    handlers.showToast(notification.message, toastType, duration, {
      skipPush,
    });
    dispatch(notificationsActions.markChannelDelivered({ id: notification.id, channel: 'toast' }));
  }

  const blurred = focus.documentHidden || !focus.hasFocus;
  if (plan.browserPush && blurred && handlers.browserNotificationsEnabled && !delivered.push) {
    if (shouldSkipDedup(`push:${dedupKey}`)) {
      return;
    }

    if (notification.category === 'fuel' && handlers.showFuelRequestNotification) {
      const pushKind = fuelPushKindFromNotification(notification);
      if (pushKind) {
        try {
          handlers.showFuelRequestNotification(pushKind, {
            id: notification.metadata?.requestId,
            fuelAmount: notification.metadata?.fuelAmount,
            vehicleName: notification.metadata?.vehicleName,
            driverName: notification.metadata?.driverName,
            reason: notification.metadata?.reason,
          });
          dispatch(notificationsActions.markChannelDelivered({ id: notification.id, channel: 'push' }));
          return;
        } catch (e) {
          console.warn('Fuel push delivery failed:', e);
        }
      }
    }

    if (handlers.showTypedPushNotification && handlers.serviceWorkerReady) {
      try {
        handlers.showTypedPushNotification(
          notification.title,
          mapSeverityToToastType(notification.severity),
          {
            tag: `numz-${notification.id}`,
            requireInteraction: notification.severity === 'critical',
            data: {
              notificationId: notification.id,
              type: notification.type,
              requestId: notification.metadata?.requestId,
            },
          },
        );
        dispatch(notificationsActions.markChannelDelivered({ id: notification.id, channel: 'push' }));
      } catch (e) {
        console.warn('Push delivery failed:', e);
      }
    }
  }
}

function fuelPushKindFromNotification(n) {
  const t = n.type || '';
  if (t.includes('created')) return 'request-created';
  if (t.includes('approved')) return 'request-approved';
  if (t.includes('rejected')) return 'request-rejected';
  if (t.includes('fulfilled')) return 'request-fulfilled';
  if (t.includes('cancelled')) return 'request-cancelled';
  return null;
}
