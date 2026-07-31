import {
  Box, List, ListItemButton, ListItemIcon, ListItemText, Typography, Chip,
} from '@mui/material';
import { SETTINGS_SECTIONS, SETTINGS_CATEGORIES, isSettingsSectionVisible } from './settingsSectionRegistry.js';
import { useAdministrator, useManager, useTechnician } from '../../common/util/permissions.js';
import useFeatures from '../../common/util/useFeatures.js';
import useSettingsSection from './hooks/useSettingsSection.js';

export default function SettingsSubNav({ desktop }) {
  const manager = useManager();
  const admin = useAdministrator();
  const technician = useTechnician();
  const features = useFeatures();
  const { activeId, goToSection } = useSettingsSection();

  const visible = SETTINGS_SECTIONS.filter((section) => (
    isSettingsSectionVisible(section, { manager, admin, technician, features })
  ));

  // Overview has category: null — it's pinned above the categories, not one
  // of the six, so it's rendered separately rather than in the group loop.
  const pinned = visible.filter((section) => !section.category);

  // Group by category, preserving SETTINGS_CATEGORIES' declared order rather
  // than the registry array's insertion order — categories stay in the same
  // place in the rail no matter which order sections were added to the file.
  const categoryOrder = Object.keys(SETTINGS_CATEGORIES);
  const byCategory = categoryOrder
    .map((key) => ({
      key,
      label: SETTINGS_CATEGORIES[key],
      sections: visible.filter((section) => section.category === key),
    }))
    .filter((group) => group.sections.length > 0);

  const renderSection = (section) => {
    const Icon = section.icon;
    const selected = section.id === activeId;
    return (
      <ListItemButton
        key={section.id}
        selected={selected}
        disabled={!section.live}
        onClick={() => goToSection(section)}
        sx={{
          borderRadius: 'var(--radius-md)',
          mx: 0.5,
          mb: 0.25,
          '&.Mui-selected': {
            backgroundColor: 'var(--color-primary-light)',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={section.label} />
        {!section.live && (
          <Chip label="Soon" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
        )}
      </ListItemButton>
    );
  };

  return (
    <Box
      sx={{
        width: desktop ? 240 : '100%',
        flexShrink: 0,
        borderRight: desktop ? '1px solid var(--color-border)' : 'none',
        borderBottom: desktop ? 'none' : '1px solid var(--color-border)',
        pb: desktop ? 0 : 1,
      }}
    >
      {pinned.length > 0 && (
        <List dense sx={{ py: 0.5 }}>
          {pinned.map(renderSection)}
        </List>
      )}
      {byCategory.map((group) => (
        <Box key={group.key}>
          <Typography
            variant="overline"
            sx={{ px: 1.5, color: 'var(--color-text-secondary)', display: 'block', pt: 1.25 }}
          >
            {group.label}
          </Typography>
          <List dense sx={{ py: 0.5 }}>
            {group.sections.map(renderSection)}
          </List>
        </Box>
      ))}
    </Box>
  );
}
