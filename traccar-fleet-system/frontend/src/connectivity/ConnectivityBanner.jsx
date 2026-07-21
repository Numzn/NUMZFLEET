import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Snackbar, Box, Typography } from '@mui/material';
import useConnectivity from './useConnectivity.js';
import { readFleetSheetHeightCssVarPx } from '../main/fleet/fleetSheetConstants.js';

const RESTORED_TOAST_MS = 2800;

/** @param {{ kind: 'down' | 'up'; label: string }} props */
function ConnectivityStrip({ kind, label }) {
  const dotSx = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    mt: 0.15,
    bgcolor: kind === 'down' ? 'warning.main' : 'success.main',
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        minWidth: 260,
        maxWidth: 'min(420px, 92vw)',
        borderRadius: 1,
        border: '1px solid',
        borderColor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)'),
        bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.92)'),
        backdropFilter: 'blur(8px)',
        boxShadow: (t) => (t.palette.mode === 'dark' ? 2 : '0 1px 6px rgba(15,23,42,0.08)'),
      }}
    >
      <Box sx={dotSx} />
      <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1.35, color: 'text.primary' }}>
        {label}
      </Typography>
    </Box>
  );
}

function readBottomChromeInsetPx() {
  if (typeof document === 'undefined') return 0;
  try {
    const navRaw = getComputedStyle(document.documentElement).getPropertyValue('--app-bottomnav-height');
    const nav = parseFloat(String(navRaw).trim());
    const navPx = Number.isFinite(nav) ? nav : 0;
    return Math.max(navPx, readFleetSheetHeightCssVarPx());
  } catch {
    return 0;
  }
}

/**
 * Minimal connectivity strip — only truly disconnected vs brief “back online”.
 * Intentionally ignores transient latency / heartbeat blips (no “unstable” toasts).
 */
const ConnectivityBanner = () => {
  const { pathname } = useLocation();
  const { isBrowserOnline, backendReachable } = useConnectivity();
  const [showRestored, setShowRestored] = useState(false);
  const [bottomNavInset, setBottomNavInset] = useState(0);
  const wasDownRef = useRef(false);

  useLayoutEffect(() => {
    setBottomNavInset(readBottomChromeInsetPx());
  }, [pathname]);

  useLayoutEffect(() => {
    const sync = () => setBottomNavInset(readBottomChromeInsetPx());
    window.addEventListener('resize', sync);
    window.addEventListener('fleet-sheet-height', sync);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('fleet-sheet-height', sync);
      vv?.removeEventListener('resize', sync);
    };
  }, []);

  const isDown = !isBrowserOnline || !backendReachable;

  useEffect(() => {
    if (isDown) {
      wasDownRef.current = true;
      setShowRestored(false);
      return undefined;
    }
    if (wasDownRef.current && !isDown) {
      wasDownRef.current = false;
      setShowRestored(true);
    }
    return undefined;
  }, [isDown]);

  const handleRestoreClose = (_, reason) => {
    if (reason === 'timeout' || reason === 'clickaway') {
      setShowRestored(false);
    }
  };

  /** @type {{ kind: 'down'|'up', label: string } | null} */
  let strip = null;
  if (!isBrowserOnline) {
    strip = { kind: 'down', label: "You're offline. Reconnecting when the network is back…" };
  } else if (!backendReachable) {
    strip = { kind: 'down', label: "Can't reach the server. Reconnecting…" };
  } else if (showRestored) {
    strip = { kind: 'up', label: 'Back online.' };
  }

  if (!strip) return null;

  const snackBottom =
    bottomNavInset > 0
      ? `calc(${bottomNavInset}px + env(safe-area-inset-bottom, 0px) + 8px)`
      : undefined;

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      autoHideDuration={strip.kind === 'up' ? RESTORED_TOAST_MS : null}
      onClose={strip.kind === 'up' ? handleRestoreClose : undefined}
      sx={{
        pointerEvents: 'none',
        ...(snackBottom != null ? { bottom: snackBottom } : {}),
      }}
    >
      <Box sx={{ pointerEvents: 'auto' }}>
        <ConnectivityStrip kind={strip.kind} label={strip.label} />
      </Box>
    </Snackbar>
  );
};

export default ConnectivityBanner;
