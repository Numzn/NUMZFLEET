import { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useSelector } from 'react-redux';

/**
 * Pre-login copy from:
 *   1) Traccar GET /api/server (Redux) — web.loginInsight, description, announcement, web.loginInsightSub
 *   2) Fuel API GET /api/public/login-insight — same ERB stack as dashboard /api/reports/erb/latest (server fills cache on demand)
 */

const ATTR_CUSTOM_PRIMARY = 'web.loginInsight';
const ATTR_CUSTOM_SECONDARY = 'web.loginInsightSub';
const ATTR_DESCRIPTION = 'description';

const MAX_LEN = 200;

const coerce = (v) => {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : String(v);
  return s.trim();
};

const truncate = (s) => {
  const t = coerce(s);
  if (!t) return '';
  if (t.length <= MAX_LEN) return t;
  return `${t.slice(0, MAX_LEN - 1)}…`;
};

function parseServerAttributes(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...raw };
  }
  return {};
}

const LoginInsights = () => {
  const attrsRaw = useSelector((state) => state.session?.server?.attributes);
  const attributes = useMemo(() => parseServerAttributes(attrsRaw), [attrsRaw]);
  const announcement = useSelector((state) => state.session?.server?.announcement);

  const [remote, setRemote] = useState({ primary: null, secondary: null });

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      fetch('/api/public/login-insight', { credentials: 'omit' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (cancelled || !j) return;
          if (j.primary || j.secondary) {
            setRemote({ primary: j.primary || null, secondary: j.secondary || null });
          }
        })
        .catch(() => {});
    };
    load();
    // Fuel-api may populate cache a few seconds after boot; poll briefly so login picks it up without refresh
    const intervalId = setInterval(load, 60000);
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        load();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, []);

  const customPrimary = truncate(attributes[ATTR_CUSTOM_PRIMARY]);
  const description = truncate(attributes[ATTR_DESCRIPTION]);
  const remotePrimary = truncate(remote.primary);
  const remoteSecondary = truncate(remote.secondary);

  const primary =
    customPrimary ||
    description ||
    truncate(announcement) ||
    remotePrimary;

  const secondary =
    truncate(attributes[ATTR_CUSTOM_SECONDARY]) || remoteSecondary;

  if (!primary && !secondary) {
    return null;
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: (theme) => theme.spacing(52),
        mb: 2,
        px: 0.5,
        borderLeft: (theme) => `3px solid ${theme.palette.primary.main}`,
        pl: 1.75,
        py: 0.25,
      }}
    >
      {primary ? (
        <Typography
          variant="body2"
          sx={{
            color: 'text.primary',
            fontWeight: 500,
            letterSpacing: '0.01em',
            lineHeight: 1.45,
          }}
        >
          {primary}
        </Typography>
      ) : null}
      {secondary ? (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: primary ? 0.5 : 0,
            color: 'text.secondary',
            lineHeight: 1.4,
          }}
        >
          {secondary}
        </Typography>
      ) : null}
    </Box>
  );
};

export default LoginInsights;
