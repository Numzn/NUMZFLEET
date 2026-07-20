import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
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

const MAX_CONNECT_FAILURES_BEFORE_PAUSE = 5;
const SOCKET_RECONNECT_ATTEMPTS = 20;

/** Remote NumzLab dev: polling-only + no remembered WS upgrade reduces proxy/Tailscale flake. */
const isRemoteFuelDev = () => Boolean(
  import.meta.env.VITE_FUEL_API_URL || import.meta.env.VITE_FUEL_API_BASE_URL,
);

const buildSocketOptions = (user) => ({
  transports: isRemoteFuelDev() ? ['polling'] : ['polling', 'websocket'],
  timeout: 20000,
  forceNew: true,
  path: '/socket.io',
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 30000,
  randomizationFactor: 0.5,
  reconnectionAttempts: SOCKET_RECONNECT_ATTEMPTS,
  withCredentials: true,
  upgrade: true,
  rememberUpgrade: !isRemoteFuelDev(),
  autoConnect: true,
  auth: {
    userId: user?.id,
    administrator: user?.administrator,
  },
});

const FuelSocketController = () => {
  const dispatch = useDispatch();
  const authenticated = useSelector((state) => !!state.session.user);
  const user = useSelector((state) => state.session.user);
  const unified = useSelector(isUnifiedNotificationsEnabled);

  const browserNotificationsEnabled = user?.attributes?.browserNotificationsEnabled !== false;

  const { ToastNotification } = useToastNotifications({
    enableBrowserNotifications: browserNotificationsEnabled,
    autoRequestPermission: false,
  });

  const socketRef = useRef(null);
  const stateRef = useRef(SOCKET_STATE.PAUSED);
  const userRef = useRef(user);
  const dispatchRef = useRef(dispatch);

  const failureStreakRef = useRef(0);

  const setState = (next, reason) => {
    if (stateRef.current === next) return;
    const prev = stateRef.current;
    stateRef.current = next;
    diag.log('fuel_socket_state', { from: prev, to: next, reason });
  };

  useEffect(() => {
    userRef.current = user;
    dispatchRef.current = dispatch;
  }, [user, dispatch]);

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

    const pauseSocket = (sock, reason) => {
      if (!sock) return;
      try {
        if (sock.io?.opts) sock.io.opts.reconnection = false;
        sock.disconnect();
      } catch (err) {
        diag.warn('fuel_socket_pause_failed', { error: String(err && err.message) });
      }
      setState(SOCKET_STATE.OFFLINE, reason);
    };

    const resumeSocket = (sock, reason) => {
      if (!sock) return;
      failureStreakRef.current = 0;
      try {
        if (sock.io?.opts) sock.io.opts.reconnection = true;
        sock.auth = {
          userId: userRef.current?.id,
          administrator: userRef.current?.administrator,
        };
        if (!sock.connected) sock.connect();
      } catch (err) {
        diag.warn('fuel_socket_resume_failed', { error: String(err && err.message) });
      }
      setState(SOCKET_STATE.RECONNECTING, reason);
    };

    if (!socket || (!socket.connected && !socket.active)) {
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }

      socket = io(fuelApiUrl, buildSocketOptions(user));

      socketRef.current = socket;
      setState(SOCKET_STATE.RECONNECTING, 'init');
    } else if (socket.auth) {
      socket.auth.userId = user?.id;
      socket.auth.administrator = user?.administrator;
    }

    const initialSnap = ConnectivityService.getSnapshot();
    if (!initialSnap.isBrowserOnline || !initialSnap.backendReachable) {
      pauseSocket(
        socket,
        !initialSnap.isBrowserOnline ? 'browser_offline' : 'backend_unreachable',
      );
    }

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

      const snap = ConnectivityService.getSnapshot();
      if (
        failureStreakRef.current >= MAX_CONNECT_FAILURES_BEFORE_PAUSE
        || !snap.backendReachable
      ) {
        pauseSocket(socketRef.current, 'too_many_errors');
        setState(SOCKET_STATE.FAILED, 'too_many_errors');
      } else if (failureStreakRef.current >= 3 && stateRef.current !== SOCKET_STATE.OFFLINE) {
        setState(SOCKET_STATE.FAILED, 'transport_errors');
      }
    });

    const unsubscribeConnectivity = ConnectivityService.subscribe((snap) => {
      if (!socketRef.current) return;
      const sock = socketRef.current;
      const shouldPause = !snap.isBrowserOnline || !snap.backendReachable;

      if (shouldPause) {
        if (stateRef.current !== SOCKET_STATE.OFFLINE) {
          pauseSocket(
            sock,
            !snap.isBrowserOnline ? 'connectivity_offline' : 'backend_unreachable',
          );
        }
        return;
      }

      if (
        stateRef.current === SOCKET_STATE.OFFLINE
        || stateRef.current === SOCKET_STATE.FAILED
      ) {
        resumeSocket(sock, 'connectivity_online');
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
      failureStreakRef.current = 0;
    };
  }, [authenticated, user?.id, unified]);

  if (unified) {
    return null;
  }

  return <ToastNotification />;
};

export default FuelSocketController;
