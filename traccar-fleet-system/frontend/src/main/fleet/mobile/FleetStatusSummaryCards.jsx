import { Box, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PauseIcon from '@mui/icons-material/Pause';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import { useDispatch, useSelector } from 'react-redux';
import { fleetInteractionActions } from '../../../store';
import { STATUS_TINT, fleetMetricTileSx } from './fleetMobileCardSx';

const TILES = [
  { tab: 'moving', label: 'Moving', tint: STATUS_TINT.moving, Icon: TrendingUpIcon },
  { tab: 'idle', label: 'Idle', tint: STATUS_TINT.idle, Icon: PauseIcon },
  { tab: 'offline', label: 'Offline', tint: STATUS_TINT.offline, Icon: SignalWifiOffIcon },
];

/**
 * Mobile fleet summary tiles. Tapping a tile filters the list via `fleetTab`;
 * tapping the active tile again clears the filter back to "all".
 */
const FleetStatusSummaryCards = ({ deviceStats = {} }) => {
  const dispatch = useDispatch();
  const fleetTab = useSelector((s) => s.fleetInteraction.fleetTab);

  const counts = {
    moving: deviceStats.moving ?? 0,
    idle: deviceStats.idling ?? 0,
    offline: deviceStats.offline ?? 0,
  };

  const handleTap = (tab) => {
    dispatch(fleetInteractionActions.setFleetTab(fleetTab === tab ? 'all' : tab));
  };

  return (
    <Box sx={{ display: 'flex', gap: 'var(--space-2)', px: 'var(--space-3)', py: 'var(--space-2)' }}>
      {TILES.map(({ tab, label, tint, Icon }) => {
        const selected = fleetTab === tab;
        return (
          <Box
            key={tab}
            component="button"
            type="button"
            onClick={() => handleTap(tab)}
            aria-pressed={selected}
            sx={{
              ...fleetMetricTileSx,
              borderColor: selected ? tint.fg : 'var(--surface-border)',
              boxShadow: selected ? `inset 0 0 0 1px ${tint.fg}` : 'none',
            }}
          >
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: tint.bg,
                color: tint.fg,
                '& svg': { fontSize: '1rem' },
              }}
            >
              <Icon />
            </Box>
            <Typography
              sx={{
                fontSize: '1.25rem',
                fontWeight: 700,
                lineHeight: 1.1,
                color: 'var(--color-text-primary)',
              }}
            >
              {counts[tab]}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
              }}
            >
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default FleetStatusSummaryCards;
