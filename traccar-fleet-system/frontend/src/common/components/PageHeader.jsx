import { Box, Typography, Stack } from '@mui/material';

/**
 * The one title row every page uses.
 *
 * Before this existed, each page drew its own: the dashboard used a gradient
 * bar with outlined buttons, Vehicles used a plain title with a grey subtitle
 * and a filled button, Drivers used an h5, the Settings Center used an h6. Same
 * position on screen, four different designs — that drift is what made the app
 * read as inconsistent, and it is structural, not cosmetic. There was no shared
 * header component anywhere in 421 files.
 *
 * Extracted from settings/center/components/SettingsSectionPanel.jsx, whose
 * docblock already claimed this role; that component now composes this one, so
 * its nine consumers are unchanged.
 *
 * `meta` is a list of structured facts rendered as "a · b · c" — prefer it to
 * `subtitle` prose on pages a user visits daily, where a sentence of
 * explanation becomes permanent noise after the second visit.
 */
export default function PageHeader({
  title,
  subtitle,
  meta,
  actions,
  titleVariant = 'h6',
}) {
  const metaLine = Array.isArray(meta) ? meta.filter(Boolean) : null;

  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2,
    }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant={titleVariant} fontWeight={700}>{title}</Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
        {metaLine?.length > 0 && (
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.5 }}>
            {metaLine.join(' · ')}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Box>
  );
}
