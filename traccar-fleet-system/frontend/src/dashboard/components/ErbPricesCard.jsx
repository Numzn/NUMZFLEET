import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Chip,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';

const FUEL_ITEMS = [
  { key: 'petrol',   label: 'Petrol',   color: '#67e8f9' },
  { key: 'diesel',   label: 'Diesel',   color: '#fbbf24' },
  { key: 'kerosene', label: 'Kerosene', color: '#86efac' },
  { key: 'jetA1',    label: 'Jet A-1',  color: '#c4b5fd' },
];

const parsePublicInsightPrices = (text) => {
  if (!text) return null;
  const out = {};
  const pairs = [
    { key: 'petrol', re: /petrol\s*K?\s*([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'diesel', re: /diesel\s*K?\s*([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'kerosene', re: /kerosene\s*K?\s*([0-9]+(?:\.[0-9]+)?)/i },
    { key: 'jetA1', re: /jet[\s-]*a1\s*K?\s*([0-9]+(?:\.[0-9]+)?)/i },
  ];
  pairs.forEach(({ key, re }) => {
    const match = text.match(re);
    if (match?.[1]) {
      out[key] = Number(match[1]);
    }
  });
  return Object.keys(out).length ? out : null;
};

/** Merge fuel-api `prices` objects (nullable per key) into a card-friendly map. */
const normalizePricesMap = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  let any = false;
  for (const key of ['petrol', 'diesel', 'kerosene', 'jetA1']) {
    const v = raw[key];
    const n = v != null && v !== '' ? Number(v) : NaN;
    if (Number.isFinite(n)) {
      out[key] = n;
      any = true;
    }
  }
  return any ? out : null;
};

const ErbPricesCard = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const user = useSelector((state) => state.session.user);

  const [prices, setPrices] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Public ERB snapshot should work for all users (login + dashboard parity).
        const publicRes = await fetch('/api/public/login-insight', {
          credentials: 'omit',
          headers: { Accept: 'application/json' },
        });
        const publicData = publicRes.ok ? await publicRes.json().catch(() => null) : null;
        const fromPublicStructured = normalizePricesMap(publicData?.prices);
        const fromPublicParsed = parsePublicInsightPrices(publicData?.primary || '');
        const fromPublic =
          fromPublicStructured
          ?? (fromPublicParsed && Object.keys(fromPublicParsed).length ? fromPublicParsed : null);

        // Same as fleet APIs: rely on authenticated session cookies.
        const authRes = await fetch('/api/reports/erb/latest', {
          credentials: 'include',
          headers: { Accept: 'application/json', ...fuelApiAuthHeaders(user) },
        });
        let authPayload = null;
        try {
          authPayload = await authRes.json();
        } catch {
          authPayload = null;
        }
        const authPrices = normalizePricesMap(authPayload?.prices);

        if (authPrices) {
          if (!cancelled) {
            setPrices(authPrices);
            setTimestamp(authPayload?.timestamp ?? publicData?.updatedAt ?? null);
          }
          return;
        }

        if (fromPublic) {
          if (!cancelled) {
            setPrices(fromPublic);
            setTimestamp(publicData?.updatedAt ?? null);
          }
          return;
        }

        if (!publicRes.ok) {
          throw new Error(`Login insight HTTP ${publicRes.status}`);
        }
        const apiMsg =
          typeof authPayload?.error === 'string' && authPayload.error.trim()
            ? authPayload.error.trim()
            : null;
        if (authRes.status === 401 || authRes.status === 403) {
          if (!user?.id && !user?.userId) {
            throw new Error('Sign in first, then refresh to load ERB prices');
          }
          throw new Error('Fuel API auth not ready (missing x-user-id / session). Refresh after login.');
        }
        if (authRes.status === 503 && apiMsg?.toLowerCase?.().includes('token')) {
          throw new Error('ERB is not configured. Set ERB_API_TOKEN in backend/.env, restart docker compose, then refresh.');
        }
        if (apiMsg) {
          throw new Error(apiMsg);
        }
        if (authRes.status >= 400) {
          throw new Error(`Fuel API returned ${authRes.status} (check ERB_API_TOKEN and erb-api)`);
        }
        throw new Error('No ERB prices available yet');
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    // Refresh every 10 minutes
    const interval = setInterval(load, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id]);

  const formatTimestamp = (ts) => {
    if (!ts) return null;
    try {
      const d = new Date(ts);
      return d.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  };

  const formatPrice = (value) => {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
  };

  const cardBg = dark
    ? 'linear-gradient(135deg, rgba(4,15,28,0.94) 0%, rgba(8,34,56,0.92) 55%, rgba(10,79,98,0.9) 100%)'
    : 'linear-gradient(135deg, rgba(8,28,46,0.96) 0%, rgba(10,69,96,0.92) 58%, rgba(13,138,165,0.88) 100%)';

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        p: { xs: 2, sm: 2.5 },
        borderRadius: { xs: '20px', md: '22px' },
        border: `1px solid ${alpha('#9be7f5', dark ? 0.18 : 0.28)}`,
        background: cardBg,
        boxShadow: dark
          ? '0 12px 36px rgba(0,0,0,0.28)'
          : '0 12px 38px rgba(6,37,64,0.14)',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '-30%',
          right: '-8%',
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(103,232,249,0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
        },
      }}
    >
      {/* Header row */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, position: 'relative', zIndex: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 34,
              height: 34,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '10px',
              backgroundColor: alpha('#67e8f9', 0.14),
              boxShadow: `0 0 0 1px ${alpha('#67e8f9', 0.2)}`,
            }}
          >
            <LocalGasStationIcon sx={{ fontSize: '1.1rem', color: '#67e8f9' }} />
          </Box>
          <Box>
            <Typography sx={{ color: '#f8fdff', fontWeight: 700, fontSize: { xs: '0.9rem', sm: '0.95rem' }, lineHeight: 1.15 }}>
              ERB Fuel Prices
            </Typography>
            <Typography sx={{ color: 'rgba(226,241,248,0.55)', fontSize: '0.68rem', lineHeight: 1.2 }}>
              Regulated pump prices · Zambia
            </Typography>
          </Box>
        </Stack>
        <Chip
          label="Live"
          size="small"
          sx={{
            height: 22,
            fontSize: '0.65rem',
            fontWeight: 700,
            backgroundColor: alpha('#67e8f9', 0.12),
            border: `1px solid ${alpha('#67e8f9', 0.22)}`,
            color: '#9be7f5',
            '& .MuiChip-label': { px: 1 },
          }}
        />
      </Stack>

      {/* Price grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: { xs: 1, sm: 1.25 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        {FUEL_ITEMS.map(({ key, label, color }) => (
          <Box
            key={key}
            sx={{
              px: { xs: 1.25, sm: 1.5 },
              py: { xs: 1, sm: 1.25 },
              borderRadius: '14px',
              backgroundColor: alpha(color, 0.08),
              border: `1px solid ${alpha(color, 0.18)}`,
            }}
          >
            <Typography
              sx={{
                color: alpha(color, 0.82),
                fontSize: { xs: '0.62rem', sm: '0.68rem' },
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                mb: 0.5,
              }}
            >
              {label}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width="60%" sx={{ bgcolor: alpha(color, 0.12) }} />
            ) : error ? (
              <Typography sx={{ color: alpha('#fda4af', 0.8), fontSize: '0.78rem', fontWeight: 700 }}>
                —
              </Typography>
            ) : (
              <Typography sx={{ color: '#f8fdff', fontSize: { xs: '1.1rem', sm: '1.2rem' }, fontWeight: 800, lineHeight: 1 }}>
                {formatPrice(prices?.[key]) ?? '—'}
                <Typography component="span" sx={{ color: alpha('#f8fdff', 0.55), fontSize: '0.68rem', fontWeight: 600, ml: 0.4 }}>
                  ZMW/L
                </Typography>
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        sx={{ mt: 1.5, position: 'relative', zIndex: 1 }}
      >
        {error ? (
          <>
            <ErrorOutlineIcon sx={{ fontSize: '0.8rem', color: '#fda4af' }} />
            <Typography sx={{ color: '#fda4af', fontSize: '0.7rem' }}>
              Could not load prices — {error}
            </Typography>
          </>
        ) : (
          <>
            <AccessTimeIcon sx={{ fontSize: '0.8rem', color: 'rgba(226,241,248,0.45)' }} />
            <Typography sx={{ color: 'rgba(226,241,248,0.45)', fontSize: '0.7rem' }}>
              {loading ? 'Loading…' : `Scraped from erb.org.zm · ${formatTimestamp(timestamp) || 'Unknown time'}`}
            </Typography>
          </>
        )}
      </Stack>
    </Box>
  );
};

export default ErbPricesCard;
