import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { fuelRequestsActions } from '../store/fuelRequests';
import { useToastNotifications } from '../../hooks/useToastNotifications';
import ConnectivityService from '../../connectivity/ConnectivityService';
import diag from '../../common/util/diagLogger';
import { notificationsActions } from '../../store/notifications/notificationsSlice.js';
import { normalizeNotificationCreated } from '../../notifications/adapters/normalizeNotificationCreated.js';
import { isUnifiedNotificationsEnabled } from '../../notifications/notificationFeatureFlags.js';
import { requestNotificationSync } from '../../notifications/NotificationSyncController.jsx';

const SOCKET_STATE = Object.freeze({
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
  OFFLINE: 'OFFLINE',
  FAILED: 'FAILED',
  PAUSED: 'PAUSED',
});

const FuelSocketController = () => {
  const dispatch = useDispatch();
  const authenticated = useSelector((state) => !!state.session.user);
  const user = useSelector((state) => state.session.user);
  const unified = useSelector(isUnifiedNotificationsEnabled);

  const browserNotificationsEnabled = user?.attributes?.browserNotificationsEnabled !== false;

  const { showToast, ToastNotification, showFuelRequestNotification } = useToastNotifications({
    enableBrowserNotifications: browserNotificationsEnabled,
    autoRequestPermission: false,
  });

  const socketRef = useRef(null);
  const stateRef = useRef(SOCKET_STATE.PAUSED);
  const showToastRef = useRef(showToast);
  const showFuelRequestNotificationRef = useRef(showFuelRequestNotification);
  const userRef = useRef(user);
  const dispatchRef = useRef(dispatch);

  const shownNotificationsRef = useRef(new Set());
  const notificationTimeoutRef = useRef({});
  const tabFocusStateRef = useRef(true);
  const failureStreakRef = useRef(0);

  const setState = (next, reason) => {
    if (stateRef.current === next) return;
    const prev = stateRef.current;
    stateRef.current = next;
    diag.log('fuel_socket_state', { from: prev, to: next, reason });
  };

  useEffect(() => {
    showToastRef.current = showToast;
    showFuelRequestNotificationRef.current = showFuelRequestNotification;
    userRef.current = user;
    dispatchRef.current = dispatch;
  }, [showToast, showFuelRequestNotification, user, dispatch]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const updateFocusState = () => {
      tabFocusStateRef.current = !document.hidden && document.hasFocus();
    };

    updateFocusState();
    document.addEventListener('visibilitychange', updateFocusState);
    window.addEventListener('focus', updateFocusState);
    window.addEventListener('blur', updateFocusState);

    return () => {
      document.removeEventListener('visibilitychange', updateFocusState);
      window.removeEventListener('focus', updateFocusState);
      window.removeEventListener('blur', updateFocusState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (!authenticated || !user) {
      setState(SOCKET_STATE.PAUSED, 'no_user');
      return undefined;
    }

    const fuelApiUrl = '/';

    let socket = socketRef.current;

    if (!socket || (!socket.connected && !socket.active)) {
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }

      socket = io(fuelApiUrl, {
        transports: ['polling', 'websocket'],
        timeout: 20000,
        forceNew: false,
        path: '/socket.io',
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        randomizationFactor: 0.5,
        reconnectionAttempts: Infinity,
        withCredentials: true,
        upgrade: true,
        rememberUpgrade: true,
        autoConnect: true,
        auth: {
          userId: user?.id,
          administrator: user?.administrator,
        },
      });

      socketRef.current = socket;
      setState(SOCKET_STATE.RECONNECTING, 'init');
    }

    const initialSnap = ConnectivityService.getSnapshot();
    if (!initialSnap.isBrowserOnline) {
      try {
        if (socket.io && socket.io.opts) socket.io.opts.reconnection = false;
        socket.disconnect();
      } catch (err) {
        diag.warn('fuel_socket_pause_failed', { error: String(err && err.message) });
      }
      setState(SOCKET_STATE.OFFLINE, 'browser_offline');
    }

    const showSmartNotification = (request, change, eventType) => {
      if (!request || !request.id) return;

      const notificationId = `${eventType}-${request.id}-${change?.type || 'created'}`;

      if (shownNotificationsRef.current.has(notificationId)) {
        diag.log('fuel_notification_dedup', { id: notificationId });
        return;
      }

      shownNotificationsRef.current.add(notificationId);

      if (notificationTimeoutRef.current[notificationId]) {
        clearTimeout(notificationTimeoutRef.current[notificationId]);
      }
      notificationTimeoutRef.current[notificationId] = setTimeout(() => {
        shownNotificationsRef.current.delete(notificationId);
        delete notificationTimeoutRef.current[notificationId];
      }, 5000);

      const isManager = userRef.current?.administrator;
      const isMyRequest = request.userId === userRef.current?.id;

      if (eventType === 'fuel-request-created' && isManager) {
        setTimeout(() => {
          if (showFuelRequestNotificationRef.current) {
            try {
              showFuelRequestNotificationRef.current('request-created', {
                id: request.id,
                driverName: request.driverName || 'Driver',
                fuelAmount: request.requestedAmount,
                vehicleName: request.vehicleName,
                ...request,
              });
              diag.log('fuel_notification_push', { kind: 'request-created', id: notificationId });
            } catch (error) {
              diag.error('fuel_notification_push_error', { error: String(error && error.message) });
            }
          }
        }, 50);
      }

      if (eventType === 'fuel-request-updated' && change && (isMyRequest || isManager)) {
        const message = change.message || `Fuel request ${change.type}`;

        let notificationType = 'info';
        if (change.type === 'approved') notificationType = 'success';
        else if (change.type === 'rejected') notificationType = 'error';
        else if (change.type === 'cancelled') notificationType = 'warning';
        else if (change.type === 'fulfilled') notificationType = 'success';

        setTimeout(() => {
          const currentFocusState = tabFocusStateRef.current;

          if (currentFocusState) {
            if (showToastRef.current) {
              try {
                showToastRef.current(message, notificationType, undefined, { skipPush: true });
                diag.log('fuel_notification_toast', { id: notificationId, type: notificationType });
              } catch (error) {
                diag.error('fuel_notification_toast_error', { error: String(error && error.message) });
              }
            }
          } else if (showFuelRequestNotificationRef.current) {
            const pushNotificationType = change.type === 'approved' ? 'request-approved'
              : change.type === 'rejected' ? 'request-rejected'
                : change.type === 'fulfilled' ? 'request-fulfilled'
                  : change.type === 'cancelled' ? 'request-cancelled' : null;

            if (pushNotificationType) {
              try {
                showFuelRequestNotificationRef.current(pushNotificationType, {
                  id: request.id,
                  fuelAmount: request.approvedAmount || request.requestedAmount,
                  reason: request.notes || request.rejectionReason,
                  vehicleName: request.vehicleName,
                  ...request,
                });
                diag.log('fuel_notification_push', { kind: pushNotificationType, id: notificationId });
              } catch (error) {
                diag.error('fuel_notification_push_error', { error: String(error && error.message) });
              }
            }
          }
        }, 50);
      }
    };

    socket.off('fuel-request-created');
    socket.off('fuel-request-updated');

    socket.on('fuel-request-created', (data) => {
      const request = data.request || data;
      const change = data.change;

      dispatchRef.current(fuelRequestsActions.update([request]));

      if (unified) {
        return;
      }

      if (userRef.current?.administrator) {
        showSmartNotification(request, change, 'fuel-request-created');
      }
    });

    socket.on('fuel-request-updated', (data) => {
      const request = data.request || data;
      const change = data.change;

      if (!change) {
        diag.log('fuel_event_no_change', { id: request?.id });
      }

      dispatchRef.current(fuelRequestsActions.update([request]));

      if (unified) {
        return;
      }

      if (change) {
        showSmartNotification(request, change, 'fuel-request-updated');
      } else if (!userRef.current?.administrator && request.userId === userRef.current?.id) {
        if (showToastRef.current) {
          showToastRef.current('Your fuel request was updated', 'info', undefined, { skipPush: true });
        }
      }
    });

    socket.off('vehicle-assignment-updated');
    socket.on('vehicle-assignment-updated', () => {
      /* unified bell: notification.created only */
    });

    socket.off('erbPricesUpdated');
    socket.on('erbPricesUpdated', () => {
      /* unified bell: notification.created only */
    });

    socket.off('notification.created');
    socket.on('notification.created', (payload) => {
      if (!unified) return;
      const n = normalizeNotificationCreated(payload);
      if (n) {
        dispatchRef.current(notificationsActions.upsertOneNotification(n));
      }
    });

    socket.off('connect');
    socket.on('connect', () => {
      failureStreakRef.current = 0;
      setState(SOCKET_STATE.CONNECTED, 'connect');
      requestNotificationSync();
    });

    if (socket.connected) {
      setState(SOCKET_STATE.CONNECTED, 'already_connected');
    }

    socket.off('reconnect_attempt');
    socket.on('reconnect_attempt', (attempt) => {
      if (stateRef.current !== SOCKET_STATE.OFFLINE) {
        setState(SOCKET_STATE.RECONNECTING, 'reconnect_attempt');
      }
      diag.log('fuel_socket_reconnect_attempt', { attempt });
    });

    socket.off('disconnect');
    socket.on('disconnect', (reason) => {
      diag.warn('fuel_socket_disconnect', { reason });
      if (stateRef.current === SOCKET_STATE.CONNECTED) {
        setState(SOCKET_STATE.RECONNECTING, `disconnect:${reason}`);
      }
    });

    socket.off('connect_error');
    socket.on('connect_error', (error) => {
      failureStreakRef.current += 1;
      diag.warn('fuel_socket_connect_error', {
        message: String(error && error.message),
        type: error && error.type,
        attempt: failureStreakRef.current,
      });
      ConnectivityService.notifyFailure(error);

      if (failureStreakRef.current >= 3 && stateRef.current !== SOCKET_STATE.OFFLINE) {
        setState(SOCKET_STATE.FAILED, 'too_many_errors');
      }
    });

    const unsubscribeConnectivity = ConnectivityService.subscribe((snap) => {
      if (!socketRef.current) return;
      const sock = socketRef.current;

      if (!snap.isBrowserOnline) {
        if (stateRef.current !== SOCKET_STATE.OFFLINE) {
          try {
            if (sock.io && sock.io.opts) sock.io.opts.reconnection = false;
            sock.disconnect();
          } catch (err) {
            diag.warn('fuel_socket_pause_failed', { error: String(err && err.message) });
          }
          setState(SOCKET_STATE.OFFLINE, 'connectivity_offline');
        }
        return;
      }

      if (stateRef.current === SOCKET_STATE.OFFLINE) {
        try {
          if (sock.io && sock.io.opts) sock.io.opts.reconnection = true;
          if (!sock.connected) sock.connect();
        } catch (err) {
          diag.warn('fuel_socket_resume_failed', { error: String(err && err.message) });
        }
        setState(SOCKET_STATE.RECONNECTING, 'connectivity_online');
      }
    });

    return () => {
      try { unsubscribeConnectivity(); } catch { /* noop */ }
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setState(SOCKET_STATE.PAUSED, 'cleanup');

      Object.values(notificationTimeoutRef.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
      notificationTimeoutRef.current = {};
      shownNotificationsRef.current.clear();
      failureStreakRef.current = 0;
    };
  }, [authenticated, user?.id, unified]);

  if (unified) {
    return null;
  }

  return <ToastNotification />;
};

export default FuelSocketController;
