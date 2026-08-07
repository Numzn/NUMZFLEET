import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Chip, CircularProgress, Stack, Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsCard from '../components/SettingsCard.jsx';
import CreateCompanyDialog from '../components/CreateCompanyDialog.jsx';
import { useEffectAsync } from '../../../reactHelper';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import { formatTime } from '../../../common/util/formatter';
import { fetchCompanies } from '../platformCompaniesApi.js';

const STATUS_COLOR = {
  active: 'success', provisioning: 'info', suspended: 'warning', archived: 'default', draft: 'default',
};

/**
 * Platform-level, not company-scoped — only visible to the one real System
 * Owner today (see requiresRole: 'platformOwner' in settingsSectionRegistry.js
 * and requirePlatformOwner in fuel-api/src/middleware/authGates.js). This is
 * the MVP slice of docs/PLATFORM_ARCHITECTURE.md's Company Provisioning
 * Engine — direct password handoff, no email invites yet.
 */
export default function PlatformCompaniesSection() {
  useSetTopBarTitle('Settings');
  const currentUser = useSelector((state) => state.session.user);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timestamp, setTimestamp] = useState(Date.now());

  useEffectAsync(async () => {
    setLoading(true);
    try {
      setCompanies(await fetchCompanies(currentUser));
    } finally {
      setLoading(false);
    }
    return null;
  }, [timestamp]);

  return (
    <SettingsCenterShell>
      <SettingsSectionPanel
        title="Companies"
        description="Tenant companies on this platform. Each has its own users, vehicles, and data — fully isolated from the others."
        actions={(
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setDialogOpen(true)}>
            Create company
          </Button>
        )}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {companies.map((company) => (
              <SettingsCard key={company.id} sx={{ p: 1.5 }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={600} noWrap>{company.name}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{company.slug}</Typography>
                  </Box>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0,
                  }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {company.memberCount} member{company.memberCount === 1 ? '' : 's'}
                    </Typography>
                    {company.createdAt && (
                      <Typography variant="caption" color="text.secondary">
                        Since {formatTime(company.createdAt, 'date')}
                      </Typography>
                    )}
                    <Chip
                      size="small"
                      label={company.status}
                      color={STATUS_COLOR[company.status] || 'default'}
                      variant="outlined"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </Box>
                </Box>
              </SettingsCard>
            ))}
            {!companies.length && (
              <Typography variant="body2" color="text.secondary">No companies yet.</Typography>
            )}
          </Stack>
        )}
      </SettingsSectionPanel>
      <CreateCompanyDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => setTimestamp(Date.now())}
      />
    </SettingsCenterShell>
  );
}
