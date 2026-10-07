import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Typography, ButtonBase,
} from '@mui/material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsCard from '../components/SettingsCard.jsx';
import { SETTINGS_SECTIONS, isSettingsSectionVisible } from '../settingsSectionRegistry.js';
import { getRecentSettingsVisits } from '../recentSettingsVisits.js';
import {
  useAdministrator, useManager, useTechnician, useSuperAdmin,
} from '../../../common/util/permissions.js';
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
  const platformOwner = useSuperAdmin();
  const features = useFeatures();
  const currentContext = useSelector((state) => state.organizations?.currentContext);

  const visibleSections = useMemo(
    () => SETTINGS_SECTIONS.filter((section) => (
      section.category
      && section.live
      && isSettingsSectionVisible(section, {
        manager, admin, technician, platformOwner, features, currentContextType: currentContext?.type,
      })
    )),
    [admin, features, manager, platformOwner, technician, currentContext?.type],
  );

  const quickAccess = useMemo(() => {
    const preferred = ['profile', 'people', 'devices', 'platformAccess', 'businessAccess'];
    const byId = new Map(visibleSections.map((section) => [section.id, section]));
    return preferred.map((id) => byId.get(id)).filter(Boolean);
  }, [visibleSections]);

  const relativeTime = (timestamp) => {
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

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
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Quick access</Typography>
          <Typography variant="body2" color="text.secondary">
            Common settings and configuration options.
          </Typography>
        </Box>

        <SettingsCard>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Quick access</Typography>
          <Grid container spacing={1.5}>
            {quickAccess.map((section) => {
              const Icon = section.icon;
              return (
                <Grid item xs={12} sm={6} key={section.id}>
                  <ButtonBase
                    onClick={() => navigate(section.path)}
                    sx={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.75,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      textAlign: 'left',
                      '&:hover': { borderColor: 'var(--color-border-hover)' },
                    }}
                  >
                    <Box sx={{ color: 'var(--color-primary)', display: 'grid', placeItems: 'center' }}><Icon /></Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{section.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{section.description}</Typography>
                    </Box>
                    <ArrowForwardIosIcon sx={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
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
              {recent.map(({ section, at }) => {
                const Icon = section.icon;
                return (
                  <ButtonBase
                    key={section.id}
                    onClick={() => navigate(section.path)}
                    sx={{
                      justifyContent: 'flex-start',
                      gap: 1,
                      py: 1,
                      px: 1,
                      borderRadius: 'var(--radius-md)',
                      '&:hover': { backgroundColor: 'var(--color-surface-alt)' },
                    }}
                  >
                    <Icon fontSize="small" />
                    <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <Typography variant="body2" fontWeight={600}>{section.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{relativeTime(at)}</Typography>
                    </Box>
                    <ArrowForwardIosIcon sx={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
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
