import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { devicesActions, fleetInteractionActions } from '../../../store';
import FleetVehicleCard from './FleetVehicleCard';

const FleetVehicleCardList = ({
  devices = [],
  positions = {},
  deviceFleetVehicleIdByDeviceId = {},
  phoneByDeviceId = {},
}) => {
  const dispatch = useDispatch();
  const selectedId = useSelector((s) => s.devices.selectedId);
  const scrollTarget = useSelector((s) => s.fleetInteraction.listScrollTargetDeviceId);
  const itemRefs = useRef({});

  useEffect(() => {
    if (scrollTarget == null) return;
    const el = itemRefs.current[scrollTarget];
    el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    dispatch(fleetInteractionActions.clearListScrollTarget());
  }, [scrollTarget, dispatch]);

  const setRef = (id) => (el) => {
    if (el) itemRefs.current[id] = el;
  };

  if (!devices.length) {
    return (
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 'var(--space-3)', py: 'var(--space-3)', display: 'block', fontSize: '0.7rem' }}
      >
        No vehicles match filters.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', px: 'var(--space-3)', py: 'var(--space-2)' }}>
      {devices.map((device) => (
        <Box key={device.id} ref={setRef(device.id)}>
          <FleetVehicleCard
            device={device}
            position={positions[device.id]}
            selected={selectedId === device.id}
            fleetVehicleId={deviceFleetVehicleIdByDeviceId[Number(device.id)]}
            phone={phoneByDeviceId[device.id] || device.contact || device.phone || null}
            onSelect={(id) => {
              dispatch(devicesActions.selectId(id));
              dispatch(fleetInteractionActions.setMobileDrawerOpen(false));
            }}
          />
        </Box>
      ))}
    </Box>
  );
};

export default FleetVehicleCardList;
