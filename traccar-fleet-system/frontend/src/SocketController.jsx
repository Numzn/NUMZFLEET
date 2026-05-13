import {
  useCallback, useEffect, useRef,
} from 'react';
import { traccarPath, traccarFetch } from './config/traccarApi.js';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { devicesActions, sessionActions, notificationsActions } from './store';
import { useCatchCallback, useEffectAsync } from './reactHelper';
import alarm from './resources/alarm.mp3';
import { eventsActions } from './store/events';
import useFeatures from './common/util/useFeatures';
import { useAttributePreference } from './common/util/preferences';
import { handleNativeNotificationListeners, nativePostMessage } from './common/components/NativeInterface';
import { useTranslation } from './common/components/LocalizationProvider';
import { normalizeTraccarEvent } from './notifications/adapters/normalizeTraccarEvent.js';
import { isUnifiedNotificationsEnabled } from './notifications/notificationFeatureFlags.js';

const logoutCode = 4000;

const SocketController = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const authenticated = useSelector((state) => Boolean(state.session.user));
  const includeLogs = useSelector((state) => state.session.includeLogs);
  const unified = useSelector(isUnifiedNotificationsEnabled);

  const socketRef = useRef();
  const retryCountRef = useRef(0);

  const soundEvents = useAttributePreference('soundEvents', '');
  const soundAlarms = useAttributePreference('soundAlarms', 'sos');

  const features = useFeatures();

  const refreshSnapshot = useCallback(async () => {
    try {
      const [devicesResponse, positionsResponse] = await Promise.all([
        traccarFetch('/api/devices'),
        traccarFetch('/api/positions'),
      ]);

      if (devicesResponse.ok) {
        dispatch(devicesActions.refresh(await devicesResponse.json()));
      }
      if (positionsResponse.ok) {
        dispatch(sessionActions.updatePositions(await positionsResponse.json()));
      }

      if (devicesResponse.status === 401 || positionsResponse.status === 401) {
        navigate('/login');
      }
    } catch {
      // ignore refresh errors; websocket will retry independently
    }
  }, [dispatch, navigate]);

  const handleEvents = useCallback((events) => {
    if (!features.disableEvents) {
      dispatch(eventsActions.add(events));
    }

    if (unified) {
      const batch = events
        .map((e) => normalizeTraccarEvent(e, { t }))
        .filter(Boolean);
      if (batch.length) {
        dispatch(notificationsActions.upsertManyNotifications(batch));
      }
      return;
    }

    if (events.some((e) => soundEvents.includes(e.type)
        || (e.type === 'alarm' && soundAlarms.includes(e.attributes.alarm)))) {
      const audio = new Audio(alarm);
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('Audio playback failed:', err);
          }
        });
      }
    }
  }, [features, dispatch, soundEvents, soundAlarms, unified, t]);

  const connectSocket = () => {
    const wsUrl = window.location.origin.replace(/^http/, 'ws');

    const socket = new WebSocket(`${wsUrl}${traccarPath('/api/socket')}`);
    socketRef.current = socket;

    socket.onopen = () => {
      retryCountRef.current = 0;
      dispatch(sessionActions.updateSocket(true));
    };

    socket.onerror = (error) => {
      console.error('[WebSocket] Connection error:', error);
    };

    socket.onclose = async (event) => {
      console.warn('[WebSocket] Disconnected, code:', event.code);
      dispatch(sessionActions.updateSocket(false));
      if (event.code !== logoutCode) {
        await refreshSnapshot();
        const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 60000);
        retryCountRef.current += 1;
        setTimeout(connectSocket, retryDelay);
      }
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.devices) {
        dispatch(devicesActions.update(data.devices));
      }
      if (data.positions) {
        dispatch(sessionActions.updatePositions(data.positions));
      }
      if (data.events) {
        handleEvents(data.events);
      }
      if (data.logs) {
        dispatch(sessionActions.updateLogs(data.logs));
      }
    };
  };

  useEffect(() => {
    socketRef.current?.send(JSON.stringify({ logs: includeLogs }));
  }, [includeLogs]);

  useEffectAsync(async () => {
    if (authenticated) {
      await refreshSnapshot();
      nativePostMessage('authenticated');
      connectSocket();
      return () => {
        socketRef.current?.close(logoutCode);
      };
    }
    return null;
  }, [authenticated]);

  const handleNativeNotification = useCatchCallback(async (message) => {
    const eventId = message.data.eventId;
    if (eventId) {
      const response = await traccarFetch(`/api/events/${eventId}`);
      if (response.ok) {
        const event = await response.json();
        const eventWithMessage = {
          ...event,
          attributes: { ...event.attributes, message: message.notification.body },
        };
        handleEvents([eventWithMessage]);
      }
    }
  }, [handleEvents]);

  useEffect(() => {
    handleNativeNotificationListeners.add(handleNativeNotification);
    return () => handleNativeNotificationListeners.delete(handleNativeNotification);
  }, [handleNativeNotification]);

  useEffect(() => {
    if (!authenticated) return;
    const reconnectIfNeeded = () => {
      const socket = socketRef.current;
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        connectSocket();
      } else if (socket.readyState === WebSocket.OPEN) {
        void refreshSnapshot();
      }
    };
    const onVisibility = () => {
      if (!document.hidden) {
        reconnectIfNeeded();
      }
    };
    window.addEventListener('online', reconnectIfNeeded);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', reconnectIfNeeded);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [authenticated, refreshSnapshot]);

  return null;
};

export default SocketController;
