import { useEffect, useRef } from 'react';
import { List, Typography, Box } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { devicesActions, fleetInteractionActions } from '../../store';
import VehicleListItem from './VehicleListItem';

const VehicleList = ({ devices = [], positions = {}, deviceFleetVehicleIdByDeviceId = {} }) => {
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
        sx={{ px: 1, py: 1.25, display: 'block', fontSize: '0.7rem' }}
      >
        No vehicles match filters.
      </Typography>
    );
  }

  return (
    <List dense disablePadding sx={{ py: 0.25, display: 'flex', flexDirection: 'column', gap: 0 }}>
      {devices.map((device) => (
        <Box key={device.id} ref={setRef(device.id)}>
          <VehicleListItem
            device={device}
            position={positions[device.id]}
            selected={selectedId === device.id}
            fleetVehicleId={deviceFleetVehicleIdByDeviceId[Number(device.id)]}
            onSelect={(id) => {
              dispatch(devicesActions.selectId(id));
              dispatch(fleetInteractionActions.setMobileDrawerOpen(false));
            }}
            onHover={(id) => dispatch(fleetInteractionActions.setHoveredDeviceId(id))}
          />
        </Box>
      ))}
    </List>
  );
};

export default VehicleList;
