import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  fetchVapidPublicKey, fetchPushSubscriptionStatus, registerPushSubscription, removePushSubscription,
} from '../settings/center/pushSubscriptionApi.js';

/**
 * atob-based, not a library — this is the one standard conversion every Web
 * Push guide uses (browsers accept the VAPID public key as a Uint8Array, not
 * the raw base64url string): MDN's push notifications guide and the W3C
 * Push API spec both document exactly this algorithm.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * navigator.serviceWorker.ready never resolves if no service worker has been
 * registered on this origin (e.g. the Vite dev server, which never emits
 * /sw.js — see useServiceWorker.js's shouldRegisterServiceWorker). Without
 * this, subscribe() below hangs forever with loading stuck true and no
 * error, so the button just silently freezes on first click.
 */
function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Real Web Push subscription lifecycle — distinct from useServiceWorker.js's
 * showPushNotification (same-device, same-session local display) and
 * useBrowserNotifications.js (plain Notification API, no server round-trip).
 * This is the piece that actually registers this device with fuel-api so a
 * server-sent push can reach it while the app/tab is closed.
 */
export function usePushSubscription() {
  const user = useSelector((state) => state.session.user);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (!supported) return;
    setPermission(Notification.permission);

    let cancelled = false;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (!subscription) {
          if (!cancelled) setIsSubscribed(false);
          return;
        }
        // The browser holding a subscription object doesn't guarantee
        // fuel-api still has it (e.g. removed server-side after a 404/410
        // from the push service) — check server truth before trusting it.
        try {
          const { subscribed } = await fetchPushSubscriptionStatus(user, subscription.endpoint);
          if (!cancelled) setIsSubscribed(subscribed);
        } catch {
          if (!cancelled) setIsSubscribed(false);
        }
      })
      .catch(() => { if (!cancelled) setIsSubscribed(false); });

    return () => { cancelled = true; };
  }, [user]);

  const subscribe = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!isSupported) {
        throw new Error('Push notifications are not supported in this browser');
      }
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        throw new Error('Notification permission was not granted');
      }

      const { vapidPublicKey } = await fetchVapidPublicKey(user);
      if (!vapidPublicKey) {
        throw new Error('Push notifications are not configured on the server yet');
      }

      const registration = await withTimeout(
        navigator.serviceWorker.ready,
        8000,
        'No active service worker on this page (push requires a production build, not the dev server)',
      );
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      await registerPushSubscription(user, subscription.toJSON());
      setIsSubscribed(true);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to enable push notifications');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, user]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(user, subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to disable push notifications');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    isSupported, permission, isSubscribed, loading, error, subscribe, unsubscribe,
  };
}
