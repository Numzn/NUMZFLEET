import { Box, Typography, Stack } from '@mui/material';
import SettingsCard from './SettingsCard.jsx';

/**
 * Shared section wrapper (title + description + actions slot + card body) for
 * every Settings Center section. Built and reviewed before any individual
 * section was written, per the app-wide UI/UX audit's recommendation — the
 * vehicle workspace built an equivalent (OperationalItemPanel) explicitly for
 * cross-tab reuse and only one of four eligible tabs ever adopted it, because
 * it existed only after those tabs had already freelanced their own headings.
 * This also serves the "PageHeader" role from the plan — a separate generic
 * header component would have been near-identical for this module's needs.
 */
export default function SettingsSectionPanel({
  title, description, actions, children,
}) {
  return (
    <Stack spacing={2}>
      <Box sx={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2,
      }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>{title}</Typography>
          {description && (
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>
        {actions}
      </Box>
      <SettingsCard>{children}</SettingsCard>
    </Stack>
  );
}
