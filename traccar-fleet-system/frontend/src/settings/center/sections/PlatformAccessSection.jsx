import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Typography, List, ListItemButton, ListItemIcon, ListItemText, CircularProgress,
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import BusinessIcon from '@mui/icons-material/Business';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import { otherAccessibleContexts, switchContextAndNavigate } from '../../../saas/util/contextNavigation.js';

const CONTEXT_ICONS = {
  platform: AnalyticsIcon,
  partner: BusinessIcon,
  customer: DashboardOutlinedIcon,
};

/**
 * Workspace switcher, moved here from the main sidebar (previously
 * navigationResolver.js's "SWITCH WORKSPACE" nav group) — the same list,
 * same switch-then-navigate behavior, just living in Settings instead of
 * cluttering the fleet sidebar on every page.
 */
export default function PlatformAccessSection() {
  useSetTopBarTitle('Settings');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [switchingTo, setSwitchingTo] = useState(null);

  const user = useSelector((state) => state.session.user);
  const currentContext = useSelector((state) => state.organizations.currentContext);
  const accessibleContexts = useSelector((state) => state.organizations.accessibleContexts);

  const others = otherAccessibleContexts(currentContext, accessibleContexts);

  const handleSwitch = async (companyId) => {
    setSwitchingTo(companyId);
    try {
      await switchContextAndNavigate({
        dispatch, navigate, user, companyId,
      });
    } catch (err) {
      console.error('Failed to switch workspace:', err);
      setSwitchingTo(null);
    }
  };

  return (
    <SettingsCenterShell>
      <SettingsSectionPanel
        title="Platform"
        description="Switch between your accessible workspaces."
      >
        {others.length ? (
          <List sx={{ py: 0 }}>
            {others.map((c) => {
              const companyId = c.type === 'platform' ? 'platform' : c.companyId;
              const Icon = CONTEXT_ICONS[c.type] || DashboardOutlinedIcon;
              return (
                <ListItemButton
                  key={companyId}
                  onClick={() => handleSwitch(companyId)}
                  disabled={switchingTo !== null}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 38 }}>
                    {switchingTo === companyId ? <CircularProgress size={20} /> : <Icon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={c.label || c.companyName || (c.type === 'platform' ? 'Platform' : 'Workspace')}
                    secondary={c.type === 'platform' ? 'Platform' : c.type === 'partner' ? 'Partner' : 'My Fleet'}
                  />
                </ListItemButton>
              );
            })}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No other workspaces available to switch into.
          </Typography>
        )}
      </SettingsSectionPanel>
    </SettingsCenterShell>
  );
}
