import {
  Box, List, ListItemButton, ListItemIcon, ListItemText, Typography, Chip,
} from '@mui/material';
import { SETTINGS_SECTIONS } from './settingsSectionRegistry.js';
import { useManager, useTechnician } from '../../common/util/permissions.js';
import useSettingsSection from './hooks/useSettingsSection.js';

export default function SettingsSubNav({ desktop }) {
  const manager = useManager();
  const technician = useTechnician();
  const { activeId, goToSection } = useSettingsSection();

  const sections = SETTINGS_SECTIONS.filter((section) => {
    if (section.requiresRole === 'manager') return manager;
    if (section.requiresRole === 'technician') return technician;
    return true;
  });

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
      <Typography
        variant="overline"
        sx={{ px: 1.5, color: 'var(--color-text-secondary)', display: 'block', pt: 0.5 }}
      >
        Settings
      </Typography>
      <List dense sx={{ py: 0.5 }}>
        {sections.map((section) => {
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
        })}
      </List>
    </Box>
  );
}
