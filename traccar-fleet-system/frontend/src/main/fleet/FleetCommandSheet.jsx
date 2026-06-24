import {
  useCallback, useEffect, useLayoutEffect, useMemo, useState,
} from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import { fleetInteractionActions } from '../../store';
import FleetSearch from './FleetSearch';
import FleetVehicleList from './mobile/FleetVehicleList';
import {
  SHEET_LEVEL,
  SHEET_MAX_LEVEL,
  getSheetHeightPx,
  setFleetSheetHeightCssVar,
} from './fleetSheetConstants';

const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 4;
const HANDLE_AREA_PX = 40;

const FILTER_LABELS = {
  moving: 'Moving',
  idle: 'Idle',
  offline: 'Offline',
  alerts: 'Alerts',
};

/**
 * Mobile-only fleet tracking bottom sheet.
 * Snap cycle: collapsed (count) -> half (list) -> full (search + list) -> collapsed.
 */
const FleetCommandSheet = ({
  devices = [],
  positions = {},
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const sheetLevel = useSelector((s) => s.fleetInteraction.sheetLevel);
  const fleetTab = useSelector((s) => s.fleetInteraction.fleetTab);

  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const heightPx = useMemo(
    () => getSheetHeightPx(sheetLevel, viewportHeight),
    [sheetLevel, viewportHeight],
  );

  useLayoutEffect(() => {
    setFleetSheetHeightCssVar(heightPx);
    return () => setFleetSheetHeightCssVar(0);
  }, [heightPx]);

  const cycleSheet = useCallback(() => {
    const next = sheetLevel >= SHEET_MAX_LEVEL ? SHEET_LEVEL.CLOSED : sheetLevel + 1;
    dispatch(fleetInteractionActions.setSheetLevel(next));
  }, [dispatch, sheetLevel]);

  const isCollapsed = sheetLevel <= SHEET_LEVEL.CLOSED;
  const isHalf = sheetLevel === SHEET_LEVEL.OVERVIEW;
  const isFull = sheetLevel >= SHEET_LEVEL.LIST;

  const collapsedLabel = useMemo(() => {
    const count = devices.length;
    const noun = count === 1 ? 'Vehicle' : 'Vehicles';
    if (fleetTab !== 'all' && FILTER_LABELS[fleetTab]) {
      return `${count} ${FILTER_LABELS[fleetTab]} shown`;
    }
    return `${count} ${noun}`;
  }, [devices.length, fleetTab]);

  const listHeight = Math.max(0, heightPx - HANDLE_AREA_PX - (isFull ? 52 : 0));

  return (
    <Paper
      elevation={8}
      role="region"
      aria-label="Fleet vehicle selector"
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        height: heightPx,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px 12px 0 0',
        borderTop: '1px solid',
        borderColor: 'var(--surface-border)',
        bgcolor: 'var(--surface-card)',
        pointerEvents: 'auto',
        pb: 'env(safe-area-inset-bottom, 0px)',
        transition: theme.transitions.create('height', {
          duration: theme.transitions.duration.shorter,
          easing: theme.transitions.easing.easeInOut,
        }),
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={cycleSheet}
        aria-expanded={!isCollapsed}
        aria-label={
          isFull
            ? 'Collapse vehicle list'
            : isHalf
              ? 'Expand vehicle list'
              : 'Expand vehicle list'
        }
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minHeight: HANDLE_AREA_PX,
          flexShrink: 0,
          border: 0,
          bgcolor: 'transparent',
          cursor: 'pointer',
          py: 0.75,
          gap: 0.5,
        }}
      >
        <Box
          sx={{
            width: HANDLE_WIDTH,
            height: HANDLE_HEIGHT,
            borderRadius: HANDLE_HEIGHT,
            bgcolor: 'text.disabled',
            opacity: 0.55,
          }}
        />
        {isCollapsed ? (
          <Typography
            sx={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            {collapsedLabel}
          </Typography>
        ) : null}
      </Box>

      {!isCollapsed ? (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {isFull ? (
            <Box sx={{ flexShrink: 0, px: 'var(--space-3)', pb: 'var(--space-2)' }}>
              <FleetSearch compact placeholder="Search vehicles…" />
            </Box>
          ) : null}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: (isHalf || (isFull && devices.length < 50)) ? 'auto' : 'hidden',
              borderTop: '1px solid',
              borderColor: 'var(--surface-border)',
            }}
          >
            <FleetVehicleList
              devices={devices}
              positions={positions}
              virtualized={isFull}
              listHeight={listHeight}
            />
          </Box>
        </Box>
      ) : null}
    </Paper>
  );
};

export default FleetCommandSheet;
