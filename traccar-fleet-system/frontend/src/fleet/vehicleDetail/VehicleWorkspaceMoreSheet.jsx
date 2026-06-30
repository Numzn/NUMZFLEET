import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useNavigate, useParams } from 'react-router-dom';
import {
  VEHICLE_WORKSPACE_TABS,
  VEHICLE_WORKSPACE_TAB_IDS,
  getTabBadge,
} from './vehicleWorkspaceTabRegistry.js';
import {
  vehicleImmobilizerPath,
  vehicleSetupPath,
} from '../vehicleRegistry/vehicleRegistryUtils.js';

const MORE_TAB_IDS = [
  VEHICLE_WORKSPACE_TAB_IDS.repairs,
  VEHICLE_WORKSPACE_TAB_IDS.documents,
];

export default function VehicleWorkspaceMoreSheet({ open, onClose, tab, onTabChange, badgeContext }) {
  const navigate = useNavigate();
  const { vehicleId } = useParams();

  const moreTabs = MORE_TAB_IDS.map((id) => VEHICLE_WORKSPACE_TABS.find((t) => t.id === id)).filter(Boolean);

  const selectTab = (tabId) => {
    onTabChange(tabId);
    onClose();
  };

  return (
    <Drawer anchor="bottom" open={open} onClose={onClose}>
      <List sx={{ pb: 'env(safe-area-inset-bottom, 16px)' }}>
        {moreTabs.map((tabDef) => {
          const Icon = tabDef.icon;
          const badge = getTabBadge(tabDef.id, badgeContext);
          return (
            <ListItemButton key={tabDef.id} selected={tab === tabDef.id} onClick={() => selectTab(tabDef.id)}>
              <ListItemIcon>
                <Badge badgeContent={badge} color="error">
                  <Icon />
                </Badge>
              </ListItemIcon>
              <ListItemText primary={tabDef.label} />
            </ListItemButton>
          );
        })}
        <Divider sx={{ my: 1 }} />
        <ListItemButton
          onClick={() => {
            if (vehicleId) navigate(vehicleImmobilizerPath(vehicleId));
            onClose();
          }}
        >
          <ListItemIcon><BlockIcon color="error" /></ListItemIcon>
          <ListItemText primary="Immobilize" />
        </ListItemButton>
        <ListItemButton
          onClick={() => {
            if (vehicleId) navigate(vehicleSetupPath(vehicleId));
            onClose();
          }}
        >
          <ListItemIcon><SettingsOutlinedIcon /></ListItemIcon>
          <ListItemText primary="Vehicle setup" />
        </ListItemButton>
      </List>
    </Drawer>
  );
}
