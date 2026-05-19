import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useDispatch } from 'react-redux';
import { fleetInteractionActions } from '../../store';

/** @typedef {{ hasMoving: boolean, hasIdle: boolean, hasOffline: boolean, hasAlerts: boolean }} OperationalPresence */

/**
 * Adaptive operational filter pills (no counts). “All” always; other pills only when non-empty.
 */
const FleetOperationalPills = ({ fleetTab, presence }) => {
  const dispatch = useDispatch();
  const { hasMoving, hasIdle, hasOffline, hasAlerts } = presence;

  const pills = [{ id: 'all', label: 'All' }];
  if (hasMoving) pills.push({ id: 'moving', label: 'Moving' });
  if (hasIdle) pills.push({ id: 'idle', label: 'Idle' });
  if (hasOffline) pills.push({ id: 'offline', label: 'Offline' });
  if (hasAlerts) pills.push({ id: 'alerts', label: 'Alerts' });

  const validIds = new Set(pills.map((p) => p.id));
  const tabValue = validIds.has(fleetTab) ? fleetTab : 'all';

  const handleChange = (_, next) => {
    if (next == null) return;
    dispatch(fleetInteractionActions.setFleetTab(next));
  };

  return (
    <ToggleButtonGroup
      exclusive
      value={tabValue}
      onChange={handleChange}
      size="small"
      sx={{
        display: 'inline-flex',
        flexWrap: 'nowrap',
        gap: 0.35,
        width: 'max-content',
        '& .MuiToggleButton-root': {
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '6px',
          px: 0.85,
          py: 0.2,
          minHeight: 26,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          fontSize: '0.68rem',
          fontWeight: 600,
          textTransform: 'none',
          '&.Mui-selected': {
            bgcolor: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
            borderColor: 'var(--color-primary)',
            fontWeight: 600,
          },
        },
      }}
    >
      {pills.map((p) => (
        <ToggleButton key={p.id} value={p.id} aria-label={p.label}>
          {p.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};

export default FleetOperationalPills;
