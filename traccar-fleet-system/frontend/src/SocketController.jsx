import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { traccarPath, traccarFetch } from './config/traccarApi.js';
import { useDispatch, useSelector, connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Snackbar } from '@mui/material';
import { devicesActions, sessionActions } from './store';
import { useCatchCallback, useEffectAsync } from './reactHelper';
import { snackBarDurationLongMs } from './common/util/duration';
import alarm from './resources/alarm.mp3';
import { eventsActions } from './store/events';
import useFeatures from './common/util/useFeatures';
import { useAttributePreference } from './common/util/preferences';
import { handleNativeNotificationListeners, nativePostMessage } from './common/components/NativeInterface';

const logoutCode = 4000;

const SocketController = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const authenticated = useSelector((state) => Boolean(state.session.user));
  const includeLogs = useSelector((state) => state.session.includeLogs);

  const socketRef = useRef();
  const retryCountRef = useRef(0);

  const [notifications, setNotifications] = useState([]);

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
    if (events.some((e) => soundEvents.includes(e.type)
        || (e.type === 'alarm' && soundAlarms.includes(e.attributes.alarm)))) {
      const audio = new Audio(alarm);
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Safely ignore AbortError when play is interrupted
          if (err.name !== 'AbortError') {
            console.warn('Audio playback failed:', err);
          }
        });
      }
    }
    setNotifications(events.map((event) => ({
      id: event.id,
      message: event.attributes.message,
      show: true,
    })));
  }, [features, dispatch, soundEvents, soundAlarms]);

  const connectSocket = () => {
    // Always connect WebSocket to same origin so the session cookie is sent.
    // Production: nginx maps /traccar/api/socket -> Traccar. Dev: Vite proxies /traccar and /api/socket.
    const wsUrl = window.location.origin.replace(/^http/, 'ws');
    
    const socket = new WebSocket(`${wsUrl}${traccarPath('/api/socket')}`);
    socketRef.current = socket;

    socket.onopen = () => {
      retryCountRef.current = 0; // Reset retry count on successful connection
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
        // Implement exponential backoff with faster initial retry
        const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 60000);
        retryCountRef.current++;
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

  return (
    <>
      {notifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open={notification.show}
          message={notification.message}
          autoHideDuration={snackBarDurationLongMs}
          onClose={() => setNotifications(notifications.filter((e) => e.id !== notification.id))}
        />
      ))}
    </>
  );
};

export default connect()(SocketController);
