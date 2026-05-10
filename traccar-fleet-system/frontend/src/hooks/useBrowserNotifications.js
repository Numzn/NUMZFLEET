/**
 * Browser Notifications Utility
 * Uses the native Browser Notifications API (free, no third-party services)
 * Shows notifications outside the app even when tab is not active
 */

/**
 * Check if browser notifications are supported
 */
export const isBrowserNotificationSupported = () => {
  return 'Notification' in window;
};

/**
 * Check current notification permission status
 */
export const getNotificationPermission = () => {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
};

/**
 * Request notification permission from user
 * Returns a promise that resolves to 'granted', 'denied', or 'default'
 */
export const requestNotificationPermission = async () => {
  if (!isBrowserNotificationSupported()) {
    console.warn('Browser notifications are not supported in this browser');
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    console.warn('Notification permission was previously denied');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'default';
  }
};

/**
 * Show a browser notification
 * @param {string} title - Notification title
 * @param {object} options - Notification options
 * @param {string} options.body - Notification body text
 * @param {string} options.icon - URL to notification icon
 * @param {string} options.badge - URL to badge icon
 * @param {string} options.tag - Notification tag (replaces previous with same tag)
 * @param {boolean} options.requireInteraction - Don't auto-close
 * @param {number} options.silent - Suppress sound
 * @param {Function} options.onClick - Click handler
 * @returns {Notification|null} The notification object or null if not supported/permitted
 */
export const showBrowserNotification = (title, options = {}) => {
  if (!isBrowserNotificationSupported()) {
    console.warn('Browser notifications are not supported');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted. Current status:', Notification.permission);
    return null;
  }

  const defaultOptions = {
    body: '',
    icon: '/icon-192.png', // Default icon
    badge: '/favicon-32x32.png',
    tag: undefined, // Unique tag prevents duplicate notifications
    requireInteraction: false,
    silent: false,
    ...options,
  };

  try {
    const notification = new Notification(title, defaultOptions);

    // Handle click - focus the window
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (options.onClick) {
        options.onClick(event);
      }
      notification.close();
    };

    // Auto-close after 5 seconds if not requireInteraction
    if (!defaultOptions.requireInteraction) {
      setTimeout(() => {
        notification.close();
      }, 5000);
    }

    return notification;
  } catch (error) {
    console.error('Error showing browser notification:', error);
    return null;
  }
};

/**
 * Get notification icon based on type
 */
export const getNotificationIcon = (type) => {
  // You can customize these icon paths
  const icons = {
    success: '/icon-192.png',
    error: '/icon-192.png',
    warning: '/icon-192.png',
    info: '/icon-192.png',
  };
  return icons[type] || icons.info;
};

/**
 * Show a browser notification with type-based styling
 * @param {string} message - Notification message
 * @param {string} type - Notification type: 'success', 'error', 'warning', 'info'
 * @param {object} additionalOptions - Additional notification options
 */
export const showTypedBrowserNotification = (message, type = 'info', additionalOptions = {}) => {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const emoji = icons[type] || icons.info;
  const title = `${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)}`;

  return showBrowserNotification(title, {
    body: message,
    icon: getNotificationIcon(type),
    tag: `notification-${type}-${Date.now()}`, // Unique tag
    ...additionalOptions,
  });
};

