import {
  useCallback, useEffect, useLayoutEffect, useMemo, useState,
} from 'react';
import { Box, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import { fleetInteractionActions } from '../../store';
import FleetStatusSummaryCards from './mobile/FleetStatusSummaryCards';
import FleetVehicleCardList from './mobile/FleetVehicleCardList';
import {
  SHEET_LEVEL,
  SHEET_MAX_LEVEL,
  getSheetHeightPx,
  setFleetSheetHeightCssVar,
} from './fleetSheetConstants';

const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 4;

/**
 * Mobile-only Fleet Command bottom sheet.
 * Tapping the handle cycles closed -> overview (status cards) -> list -> closed.
 */
const FleetCommandSheet = ({
  deviceStats,
  devices = [],
  positions = {},
  deviceFleetVehicleIdByDeviceId = {},
  phoneByDeviceId = {},
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const sheetLevel = useSelector((s) => s.fleetInteraction.sheetLevel);

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

  const showOverview = sheetLevel >= SHEET_LEVEL.OVERVIEW;
  const showList = sheetLevel >= SHEET_LEVEL.LIST;

  return (
    <Paper
      elevation={8}
      role="region"
      aria-label="Fleet overview"
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
        aria-expanded={showOverview}
        aria-label={showList ? 'Collapse fleet sheet' : 'Expand fleet sheet'}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minHeight: 40,
          flexShrink: 0,
          border: 0,
          bgcolor: 'transparent',
          cursor: 'pointer',
          py: 1,
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
      </Box>
      {showOverview ? (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flexShrink: 0 }}>
            <FleetStatusSummaryCards deviceStats={deviceStats} />
          </Box>
          {showList ? (
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', borderTop: '1px solid', borderColor: 'var(--surface-border)' }}>
              <FleetVehicleCardList
                devices={devices}
                positions={positions}
                deviceFleetVehicleIdByDeviceId={deviceFleetVehicleIdByDeviceId}
                phoneByDeviceId={phoneByDeviceId}
              />
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Paper>
  );
};

export default FleetCommandSheet;
