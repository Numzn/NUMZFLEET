import { Box, Drawer } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import { fleetInteractionActions } from '../../store';
import {
  FLEET_SIDEBAR_RAIL_WIDTH_PX,
  FLEET_SIDEBAR_WIDTH_PX,
} from './fleetLayoutConstants';

/**
 * Desktop: fixed fleet column + flex map. Mobile: overlay drawer for fleet list.
 */
const FleetLayout = ({ sidebar, map }) => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const dispatch = useDispatch();
  const collapsed = useSelector((s) => s.fleetInteraction.sidebarCollapsed);
  const drawerOpen = useSelector((s) => s.fleetInteraction.mobileDrawerOpen);

  const sidebarWidth = desktop
    ? (collapsed ? FLEET_SIDEBAR_RAIL_WIDTH_PX : FLEET_SIDEBAR_WIDTH_PX)
    : 0;

  const edgeLine = theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.12)';

  return (
    <Box
      sx={{
        display: 'flex',
        flex: 1,
        flexDirection: 'row',
        minHeight: 0,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {desktop ? (
        <Box
          sx={{
            width: sidebarWidth,
            flexShrink: 0,
            borderRight: `1px solid ${edgeLine}`,
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: theme.palette.mode === 'dark'
              ? '4px 0 28px rgba(0,0,0,0.35)'
              : '4px 0 24px rgba(15,23,42,0.07)',
            zIndex: 1,
            transition: theme.transitions.create('width', {
              duration: theme.transitions.duration.shorter,
            }),
          }}
        >
          {sidebar({ collapsed, variant: 'desktop' })}
        </Box>
      ) : (
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => dispatch(fleetInteractionActions.setMobileDrawerOpen(false))}
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            sx: {
              width: 'min(92vw, 400px)',
              boxSizing: 'border-box',
            },
          }}
        >
          {sidebar({ collapsed: false, variant: 'mobile' })}
        </Drawer>
      )}

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}
      >
        {map}
      </Box>
    </Box>
  );
};

export default FleetLayout;
