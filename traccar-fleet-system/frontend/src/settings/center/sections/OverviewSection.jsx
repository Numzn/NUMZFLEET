import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Typography, ButtonBase,
} from '@mui/material';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsCard from '../components/SettingsCard.jsx';
import ModernKPICard from '../../../dashboard/components/ModernKPICard';
import { SETTINGS_SECTIONS, SETTINGS_CATEGORIES, isSettingsSectionVisible } from '../settingsSectionRegistry.js';
import { getRecentSettingsVisits } from '../recentSettingsVisits.js';
import { useAdministrator, useManager, useTechnician } from '../../../common/util/permissions.js';
import useFeatures from '../../../common/util/useFeatures.js';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';

/**
 * Settings Home — the default landing page once inside Settings (replaces
 * always-opening-on-Profile). Health cards use only data already loaded
 * app-wide (devices, fuel requests) — no new backend endpoints, matching the
 * "stage what isn't built, don't invent it" rule the rest of this migration
 * followed. Recent/quick-access both read the live settingsSectionRegistry,
 * so they never drift from what's actually reachable.
 */
export default function OverviewSection() {
  useSetTopBarTitle('Settings');
  const navigate = useNavigate();

  const manager = useManager();
  const admin = useAdministrator();
  const technician = useTechnician();
  const features = useFeatures();

  const devices = useSelector((state) => state.devices.items);
  const offlineCount = useMemo(
    () => Object.values(devices || {}).filter((d) => d.status !== 'online').length,
    [devices],
  );

  const fuelRequests = useSelector((state) => state.fuelRequests?.items || {});
  const pendingFuelCount = useMemo(() => Object.values(fuelRequests).filter((request) => {
    const status = request.status?.toLowerCase?.() || '';
    return status === 'pending' || status === 'submitted' || status === 'awaiting_approval';
  }).length, [fuelRequests]);

  const visibleSections = useMemo(
    () => SETTINGS_SECTIONS.filter((section) => (
      section.category
      && section.live
      && isSettingsSectionVisible(section, {
        manager, admin, technician, features,
      })
    )),
    [admin, features, manager, technician],
  );

  const quickAccess = useMemo(() => {
    const seen = new Set();
    const out = [];
    Object.keys(SETTINGS_CATEGORIES).forEach((key) => {
      const first = visibleSections.find((s) => s.category === key && !seen.has(s.id));
      if (first) {
        seen.add(first.id);
        out.push(first);
      }
    });
    return out;
  }, [visibleSections]);

  const recent = useMemo(() => {
    const byId = new Map(visibleSections.map((s) => [s.id, s]));
    return getRecentSettingsVisits()
      .map((entry) => ({ ...entry, section: byId.get(entry.id) }))
      .filter((entry) => entry.section);
  }, [visibleSections]);

  return (
    <SettingsCenterShell>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Overview</Typography>
          <Typography variant="body2" color="text.secondary">
            Configuration health and quick access. Press ⌘K / Ctrl+K to search any setting.
          </Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <ModernKPICard
              value={offlineCount}
              label="GPS devices offline"
              icon={<WarningAmberOutlinedIcon />}
              color={offlineCount > 0 ? 'warning' : 'success'}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <ModernKPICard
              value={pendingFuelCount}
              label="Pending fuel requests"
              icon={<LocalGasStationOutlinedIcon />}
              color={pendingFuelCount > 0 ? 'warning' : 'success'}
            />
          </Grid>
        </Grid>

        <SettingsCard>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Quick access</Typography>
          <Grid container spacing={1.5}>
            {quickAccess.map((section) => {
              const Icon = section.icon;
              return (
                <Grid item xs={6} sm={4} md={3} key={section.id}>
                  <ButtonBase
                    onClick={() => navigate(section.path)}
                    sx={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 0.5,
                      p: 1.5,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      textAlign: 'left',
                      '&:hover': { borderColor: 'var(--color-border-hover)' },
                    }}
                  >
                    <Icon fontSize="small" />
                    <Typography variant="body2" fontWeight={600}>{section.label}</Typography>
                  </ButtonBase>
                </Grid>
              );
            })}
          </Grid>
        </SettingsCard>

        {recent.length > 0 && (
          <SettingsCard>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Recently visited</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {recent.map(({ section }) => {
                const Icon = section.icon;
                return (
                  <ButtonBase
                    key={section.id}
                    onClick={() => navigate(section.path)}
                    sx={{
                      justifyContent: 'flex-start',
                      gap: 1,
                      py: 0.75,
                      px: 1,
                      borderRadius: 'var(--radius-md)',
                      '&:hover': { backgroundColor: 'var(--color-surface-alt)' },
                    }}
                  >
                    <Icon fontSize="small" />
                    <Typography variant="body2">{section.label}</Typography>
                  </ButtonBase>
                );
              })}
            </Box>
          </SettingsCard>
        )}
      </Box>
    </SettingsCenterShell>
  );
}
