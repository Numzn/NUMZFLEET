import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { devicesActions, fleetInteractionActions } from '../../../store';
import { SHEET_LEVEL } from '../fleetSheetConstants';
import FleetVehicleListRow from './FleetVehicleListRow';
import FleetVehicleVirtualList from './FleetVehicleVirtualList';

const VIRTUAL_LIST_THRESHOLD = 50;

const FleetVehicleList = ({
  devices = [],
  positions = {},
  virtualized = false,
  listHeight = 0,
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

  const handleSelect = (id) => {
    dispatch(devicesActions.selectId(id));
    // Collapse sheet so the context card is visible above the map (not buried in an expanded list).
    dispatch(fleetInteractionActions.setSheetLevel(SHEET_LEVEL.CLOSED));
    dispatch(fleetInteractionActions.requestListScrollToDevice(id));
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

  if (virtualized && devices.length >= VIRTUAL_LIST_THRESHOLD && listHeight > 0) {
    return (
      <FleetVehicleVirtualList
        devices={devices}
        positions={positions}
        selectedId={selectedId}
        listHeight={listHeight}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {devices.map((device) => (
        <Box key={device.id} ref={setRef(device.id)}>
          <FleetVehicleListRow
            device={device}
            position={positions[device.id]}
            selected={selectedId === device.id}
            onSelect={handleSelect}
          />
        </Box>
      ))}
    </Box>
  );
};

export default FleetVehicleList;
