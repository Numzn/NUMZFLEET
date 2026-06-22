import { useState, useCallback, useEffect } from 'react';
import { Snackbar, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import { snackBarDurationLongMs } from '../common/util/duration';
import {
  isBrowserNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showTypedBrowserNotification,
} from './useBrowserNotifications';
import { useServiceWorker } from './useServiceWorker';

/**
 * Hook for managing toast notifications
 * Returns showToast function and ToastNotification component
 * 
 * @param {object} options - Configuration options
 * @param {boolean} options.enableBrowserNotifications - Enable browser notifications (default: false)
 * @param {boolean} options.autoRequestPermission - Automatically request permission on mount (default: false)
 * @param {number} options.maxNotifications - Maximum number of visible notifications (default: 5)
 */
export const useToastNotifications = (options = {}) => {
  const {
    enableBrowserNotifications = false,
    autoRequestPermission = false,
    maxNotifications = 5,
  } = options;

  const [notifications, setNotifications] = useState([]);
  const [browserNotificationEnabled, setBrowserNotificationEnabled] = useState(false);
  
  // Service Worker for PWA push notifications (only when browser push is enabled)
  const {
    serviceWorkerReady,
    showTypedPushNotification,
    showFuelRequestNotification,
  } = useServiceWorker({ enabled: enableBrowserNotifications });

  // Check and request browser notification permission if enabled
  useEffect(() => {
    if (!enableBrowserNotifications) {
      return;
    }

    if (!isBrowserNotificationSupported()) {
      console.warn('⚠️ [Notification] Browser notifications are not supported in this environment');
      return;
    }

    const permission = getNotificationPermission();

    if (permission === 'granted') {
      setBrowserNotificationEnabled(true);
    } else if (autoRequestPermission && permission === 'default') {
      requestNotificationPermission().then((result) => {
        if (result === 'granted') {
          setBrowserNotificationEnabled(true);
        } else {
          console.warn('⚠️ [Notification] Permission denied or default');
        }
      });
    }
  }, [enableBrowserNotifications, autoRequestPermission]);

  const showToast = useCallback((message, type = 'info', duration = snackBarDurationLongMs, options = {}) => {
    if (!message) {
      console.warn('⚠️ [Toast] showToast called with empty message');
      return null;
    }
    
    const id = Date.now() + Math.random();
    const notification = {
      id,
      message,
      type,
      duration,
      open: true,
    };

    setNotifications((prev) => {
      const newNotifications = [...prev, notification];
      // Limit the number of visible notifications to prevent screen overflow
      if (newNotifications.length > maxNotifications) {
        // Keep only the most recent notifications
        return newNotifications.slice(-maxNotifications);
      }
      return newNotifications;
    });

    // Show push notification if enabled and permission granted (unless skipPush is true)
    if (!options.skipPush && enableBrowserNotifications && browserNotificationEnabled) {
      // Prefer service worker push notifications (works even when app closed)
      if (serviceWorkerReady && showTypedPushNotification) {
        try {
          showTypedPushNotification(message, type, {
            tag: `toast-${type}-${id}`,
            requireInteraction: type === 'error' || type === 'warning',
            data: { notificationId: id, type },
          });
        } catch (error) {
          console.error('❌ [Notification] Service worker notification failed:', error);
          // Fallback to browser notification
          if (!document.hasFocus()) {
            showTypedBrowserNotification(message, type, {
              onClick: () => {
                window.focus();
              },
            });
          }
        }
      } else if (!document.hasFocus()) {
        // Fallback to browser notification if service worker not ready
        showTypedBrowserNotification(message, type, {
          onClick: () => {
            window.focus();
          },
        });
      }
    }

    // Auto-remove after duration
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, duration);

    return id;
  }, [enableBrowserNotifications, browserNotificationEnabled, serviceWorkerReady, showTypedPushNotification]);

  const closeToast = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const ToastNotification = () => {
    return (
      <>
        {notifications.map((notification, index) => {
        const getSeverity = () => {
          switch (notification.type) {
            case 'success':
              return 'success';
            case 'error':
              return 'error';
            case 'warning':
              return 'warning';
            default:
              return 'info';
          }
        };

        const getIcon = () => {
          switch (notification.type) {
            case 'success':
              return <CheckCircleIcon />;
            case 'error':
              return <ErrorIcon />;
            case 'warning':
              return <WarningIcon />;
            default:
              return <InfoIcon />;
          }
        };

        return (
          <Snackbar
            key={notification.id}
            open={notification.open}
            autoHideDuration={notification.duration}
            onClose={() => closeToast(notification.id)}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{ 
              mt: index * 7 + 1, // Stack notifications vertically with spacing
              zIndex: 9999, // Ensure toasts appear above all content
            }}
          >
            <Alert
              onClose={() => closeToast(notification.id)}
              severity={getSeverity()}
              icon={getIcon()}
              sx={{ 
                width: '100%',
                minWidth: '300px',
                maxWidth: '500px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }}
              action={
                <IconButton
                  size="small"
                  aria-label="close"
                  color="inherit"
                  onClick={() => closeToast(notification.id)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              }
            >
              {notification.message}
            </Alert>
          </Snackbar>
        );
      })}
      </>
    );
  };

  /**
   * Request browser notification permission
   * Returns a promise that resolves to true if granted, false otherwise
   */
  const requestBrowserNotificationPermission = useCallback(async () => {
    if (!enableBrowserNotifications || !isBrowserNotificationSupported()) {
      return false;
    }

    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
      setBrowserNotificationEnabled(true);
      return true;
    }
    return false;
  }, [enableBrowserNotifications]);

  return {
    showToast,
    closeToast,
    ToastNotification,
    // Browser notification helpers
    browserNotificationSupported: isBrowserNotificationSupported(),
    browserNotificationEnabled,
    browserNotificationPermission: getNotificationPermission(),
    requestBrowserNotificationPermission,
    // PWA push notification helpers
    serviceWorkerReady,
    showFuelRequestNotification,
  };
};

