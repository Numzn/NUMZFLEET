/**
 * Custom push notification handlers for service worker
 * This file is imported by the workbox-generated service worker
 */

// Push notification event
self.addEventListener('push', (event) => {
  console.log('📨 [ServiceWorker] Push event received');
  
  if (!event.data) {
    console.warn('⚠️ [ServiceWorker] Push event has no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    // If not JSON, try text
    data = {
      title: 'Fuel Management',
      body: event.data.text() || 'New notification',
    };
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: '/favicon-32x32.png',
    image: data.image,
    actions: data.actions || [],
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    tag: data.tag || 'fuel-request',
    vibrate: data.vibrate || [200, 100, 200],
    silent: data.silent || false,
  };

  console.log('🔔 [ServiceWorker] Showing notification:', data.title, 'tag:', options.tag);

  // Close any existing notifications with the same tag to prevent duplicates
  // The browser should do this automatically, but we do it explicitly to be safe
  event.waitUntil(
    self.registration.getNotifications({ tag: options.tag }).then((notifications) => {
      // Close all existing notifications with this tag
      notifications.forEach((notification) => {
        notification.close();
      });
      
      // Show the new notification (this will replace any with the same tag)
      return self.registration.showNotification(data.title, options);
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('👆 [ServiceWorker] Notification clicked:', event.notification.tag);
  event.notification.close();

  const notificationData = event.notification.data;
  const action = event.action;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if app is already open
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();

          // Send message to client about notification action
          if (action && notificationData && notificationData.requestId) {
            client.postMessage({
              type: 'NOTIFICATION_ACTION',
              action: action,
              requestId: notificationData.requestId,
            });
          }
          return;
        }
      }

      // If app not open, open it
      let url = '/';
      if (notificationData && notificationData.requestId) {
        url = `/fuel-requests/${notificationData.requestId}`;
      }

      return clients.openWindow(url);
    })
  );
});

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('📨 [ServiceWorker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: '/icon-192.png',
      badge: '/favicon-32x32.png',
      ...options,
    });
  }
});





