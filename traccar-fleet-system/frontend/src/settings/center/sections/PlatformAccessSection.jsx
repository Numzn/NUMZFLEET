import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';

/**
 * Replaces the old Settings -> Organization entry for platform-capable
 * identities — a jump-off point into the Platform workspace
 * (saas/platform/overview) from within Settings, alongside the sidebar's
 * "SWITCH WORKSPACE" group (navigationResolver.js) and ContextSelector.
 */
export default function PlatformAccessSection() {
  useSetTopBarTitle('Settings');
  const navigate = useNavigate();

  return (
    <SettingsCenterShell>
      <SettingsSectionPanel
        title="Platform"
        description="Manage partners, direct customers, and platform-wide settings."
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
          <Typography variant="body2" color="text.secondary">
            You have platform administrator access. Open the Platform workspace to manage
            partners, direct customers, and view platform-wide statistics.
          </Typography>
          <Button
            variant="contained"
            endIcon={<OpenInNewIcon />}
            onClick={() => navigate('/saas/platform/overview')}
          >
            Open Platform
          </Button>
        </Box>
      </SettingsSectionPanel>
    </SettingsCenterShell>
  );
}
