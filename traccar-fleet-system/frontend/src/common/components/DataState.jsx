import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import useResourceState from './useResourceState.js';

const DEFAULT_MESSAGES = {
  loading: 'Loading...',
  empty: 'Nothing to show yet.',
  offline: 'You appear to be offline. Showing nothing until reconnected.',
  error: "Couldn't load this. Try again in a moment.",
};

/**
 * Standard presenter for screen states. Pass children for the success path.
 *
 * Usage:
 *   <DataState data={items} loading={loading} error={error}>
 *     {(state) => state === 'stale' ? <StaleBanner/> : null}
 *     <List items={items} />
 *   </DataState>
 *
 * Or use the simpler form by just rendering children when in success/stale.
 */
const DataState = ({
  data,
  loading,
  error,
  lastSuccessAt,
  isEmpty,
  messages,
  children,
  renderState,
}) => {
  const state = useResourceState({ data, loading, error, lastSuccessAt, isEmpty });
  const copy = { ...DEFAULT_MESSAGES, ...(messages || {}) };

  if (renderState) return renderState(state);

  if (state === 'loading') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 2 }}>{copy.loading}</Typography>
      </Box>
    );
  }

  if (state === 'offline') {
    return <Alert severity="warning">{copy.offline}</Alert>;
  }

  if (state === 'error') {
    return <Alert severity="error">{copy.error}</Alert>;
  }

  if (state === 'empty') {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">{copy.empty}</Typography>
      </Box>
    );
  }

  return (
    <>
      {state === 'stale' && (
        <Alert severity="info" sx={{ mb: 1 }}>
          Showing last known data. Reconnecting...
        </Alert>
      )}
      {children}
    </>
  );
};

export default DataState;
