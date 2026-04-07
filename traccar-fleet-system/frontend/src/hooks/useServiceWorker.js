import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing Service Worker and PWA push notifications
 * Provides service worker registration and push notification capabilities
 */
export const useServiceWorker = () => {
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      setIsSupported(true);

      // Wait for service worker to be ready
      navigator.serviceWorker.ready
        .then((reg) => {
          setRegistration(reg);
          setServiceWorkerReady(true);
        })
        .catch((error) => {
          console.error('❌ [ServiceWorker] Service Worker ready check failed:', error);
        });

      // Register service worker (VitePWA generates this)
      // In development, VitePWA serves it via dev server with devOptions.enabled
      // In production, it's in the build output
      navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
        })
        .then((reg) => {
          setRegistration(reg);

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                // New service worker available
              });
            }
          });
        })
        .catch((error) => {
          // In development, service worker might not be available if devOptions is not properly configured
          // This is a warning, not an error, as the app will still work without service worker
          if (error.message && error.message.includes('MIME type')) {
            console.warn('⚠️ [ServiceWorker] Service worker not available in development. This is normal if VitePWA dev mode needs configuration.');
            console.warn('💡 [ServiceWorker] Service worker will work in production build.');
          } else {
            console.error('❌ [ServiceWorker] Service Worker registration failed:', error);
          }
        });

      // Listen for service worker controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    } else {
      console.warn('⚠️ [ServiceWorker] Service Workers are not supported');
      setIsSupported(false);
    }
  }, []);

  /**
   * Show a push notification via service worker
   * Works even when the app is closed
   */
  const showPushNotification = useCallback(
    (title, options = {}) => {
      if (!registration || !serviceWorkerReady) {
        console.warn('⚠️ [ServiceWorker] Service Worker not ready for push notifications');
        return null;
      }

      const defaultOptions = {
        icon: '/icon-192.png',
        badge: '/pwa-64x64.png',
        tag: options.tag || `notification-${Date.now()}`,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        vibrate: options.vibrate,
        data: options.data || {},
        ...options,
      };

      try {
        return registration.showNotification(title, defaultOptions);
      } catch (error) {
        console.error('❌ [ServiceWorker] Error in showNotification:', error);
        return null;
      }
    },
    [registration, serviceWorkerReady]
  );

  /**
   * Show a typed push notification (success, error, warning, info)
   */
  const showTypedPushNotification = useCallback(
    (message, type = 'info', additionalOptions = {}) => {
      const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
      };

      const emoji = icons[type] || icons.info;
      const title = `${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)}`;

      return showPushNotification(title, {
        body: message,
        tag: `notification-${type}-${Date.now()}`,
        requireInteraction: type === 'error' || type === 'warning',
        ...additionalOptions,
      });
    },
    [showPushNotification]
  );

  /**
   * Show a fuel request notification with specific formatting
   */
  const showFuelRequestNotification = useCallback(
    (type, data) => {
      if (!registration || !serviceWorkerReady) {
        console.warn('⚠️ [ServiceWorker] Cannot show notification - service worker not ready');
        return null;
      }
      
      const notificationConfigs = {
        'request-created': {
          title: '🚗 New Fuel Request',
          body: `${data.driverName || 'Driver'} requested ${data.fuelAmount || data.requestedAmount}L`,
          actions: [
            { action: 'view', title: 'View Request' },
            { action: 'approve', title: 'Approve' },
          ],
          data: { requestId: data.id, type: 'fuel-request' },
          requireInteraction: true,
          tag: `fuel-request-${data.id}`,
        },
        'request-approved': {
          title: '✅ Fuel Request Approved',
          body: `Your request for ${data.fuelAmount || data.requestedAmount || data.approvedAmount}L was approved`,
          data: { requestId: data.id, type: 'fuel-approval' },
          tag: `fuel-approval-${data.id}`,
        },
        'request-rejected': {
          title: '❌ Fuel Request Rejected',
          body: `Your request was rejected: ${data.reason || data.notes || 'No reason provided'}`,
          data: { requestId: data.id, type: 'fuel-rejection' },
          requireInteraction: true,
          tag: `fuel-rejection-${data.id}`,
        },
        'request-fulfilled': {
          title: '⛽ Fuel Request Fulfilled',
          body: `${data.fuelAmount || data.approvedAmount}L delivered to ${data.vehicleName || 'vehicle'}`,
          data: { requestId: data.id, type: 'fuel-fulfilled' },
          tag: `fuel-fulfilled-${data.id}`,
        },
        'request-cancelled': {
          title: 'ℹ️ Fuel Request Cancelled',
          body: 'Your fuel request has been cancelled',
          data: { requestId: data.id, type: 'fuel-cancelled' },
          tag: `fuel-cancelled-${data.id}`,
        },
        'urgent-request': {
          title: '🚨 URGENT: Low Fuel',
          body: `${data.driverName || 'Driver'} has critical fuel level: ${data.fuelLevel}%`,
          actions: [
            { action: 'view', title: 'View' },
            { action: 'approve', title: 'Approve Now' },
          ],
          data: { requestId: data.id, type: 'urgent-fuel' },
          requireInteraction: true,
          tag: `urgent-fuel-${data.id}`,
          vibrate: [300, 100, 300, 100, 300],
        },
      };

      const config = notificationConfigs[type];
      if (config) {
        try {
          return showPushNotification(config.title, config);
        } catch (error) {
          console.error('❌ [ServiceWorker] Error showing notification:', error);
          return null;
        }
      } else {
        console.warn('⚠️ [ServiceWorker] Unknown notification type:', type);
        return null;
      }
    },
    [showPushNotification]
  );

  return {
    serviceWorkerReady,
    registration,
    isSupported,
    showPushNotification,
    showTypedPushNotification,
    showFuelRequestNotification,
  };
};

