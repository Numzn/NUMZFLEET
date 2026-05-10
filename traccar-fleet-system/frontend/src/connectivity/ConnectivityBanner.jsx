import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Snackbar, Alert } from '@mui/material';
import useConnectivity from './useConnectivity.js';

const RESTORED_TOAST_MS = 3000;

function readBottomNavInsetPx() {
  if (typeof document === 'undefined') return 0;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-bottomnav-height');
    const n = parseFloat(String(raw).trim());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Global connectivity banner. Sits at the bottom of the screen and surfaces
 * one calm message at a time:
 *
 *   - "You're offline. Trying to reconnect..."        when browser is offline
 *   - "Cannot reach server. Trying to reconnect..."   when backend unreachable
 *   - "Connection unstable. Live updates delayed."    when latency is high / blips
 *   - "Connection restored."                          transient on recovery
 */
const ConnectivityBanner = () => {
  const { pathname } = useLocation();
  const { isBrowserOnline, backendReachable, unstableConnection } = useConnectivity();
  const [showRestored, setShowRestored] = useState(false);
  const [bottomNavInset, setBottomNavInset] = useState(0);
  const restoredTimerRef = useRef(null);
  const wasDownRef = useRef(false);

  useLayoutEffect(() => {
    setBottomNavInset(readBottomNavInsetPx());
  }, [pathname]);

  useLayoutEffect(() => {
    const sync = () => setBottomNavInset(readBottomNavInsetPx());
    window.addEventListener('resize', sync);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      vv?.removeEventListener('resize', sync);
    };
  }, []);

  const isDown = !isBrowserOnline || !backendReachable;
  const isUnstable = !isDown && unstableConnection;

  useEffect(() => {
    if (isDown) {
      wasDownRef.current = true;
      if (restoredTimerRef.current) {
        clearTimeout(restoredTimerRef.current);
        restoredTimerRef.current = null;
      }
      setShowRestored(false);
      return undefined;
    }
    if (wasDownRef.current && !isDown) {
      wasDownRef.current = false;
      setShowRestored(true);
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = setTimeout(() => {
        setShowRestored(false);
        restoredTimerRef.current = null;
      }, RESTORED_TOAST_MS);
    }
    return undefined;
  }, [isDown]);

  useEffect(() => () => {
    if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
  }, []);

  let message = null;
  let severity = 'info';
  if (!isBrowserOnline) {
    message = "You're offline. Trying to reconnect...";
    severity = 'warning';
  } else if (!backendReachable) {
    message = 'Cannot reach server. Trying to reconnect...';
    severity = 'warning';
  } else if (isUnstable) {
    message = 'Connection unstable. Live updates may be delayed.';
    severity = 'info';
  } else if (showRestored) {
    message = 'Connection restored.';
    severity = 'success';
  }

  if (!message) return null;

  const snackBottom =
    bottomNavInset > 0
      ? `calc(${bottomNavInset}px + env(safe-area-inset-bottom, 0px) + 8px)`
      : undefined;

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{
        pointerEvents: 'none',
        ...(snackBottom != null ? { bottom: snackBottom } : {}),
      }}
    >
      <Alert
        severity={severity}
        variant="filled"
        elevation={6}
        sx={{ pointerEvents: 'auto', minWidth: 280 }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default ConnectivityBanner;
