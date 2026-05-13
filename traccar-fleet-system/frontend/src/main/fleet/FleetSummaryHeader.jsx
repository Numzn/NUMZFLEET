import { Box, Chip, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import { selectUnreadCount } from '../../store/notifications/notificationSelectors';

/**
 * Dense fleet metric strip — operational pills (not dashboard widgets).
 */
const FleetSummaryHeader = ({ deviceStats = {} }) => {
  const theme = useTheme();
  const unread = useSelector(selectUnreadCount);

  const {
    moving = 0,
    idling = 0,
    offline = 0,
  } = deviceStats;

  const chipSx = {
    height: 20,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: 'divider',
    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    '& .MuiChip-label': {
      px: 0.55,
      py: 0,
      fontSize: '0.625rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
    },
  };

  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.18)' : 'action.hover',
      }}
    >
      <Stack
        direction="row"
        flexWrap="wrap"
        useFlexGap
        sx={{ columnGap: 0.45, rowGap: 0.35, alignItems: 'center' }}
      >
        <Chip size="small" variant="outlined" color="info" label={`Moving ${moving}`} sx={chipSx} />
        <Chip size="small" variant="outlined" label={`Idle ${idling}`} sx={chipSx} />
        <Chip size="small" variant="outlined" label={`Offline ${offline}`} sx={chipSx} />
        <Chip
          size="small"
          variant={unread > 0 ? 'filled' : 'outlined'}
          color={unread > 0 ? 'secondary' : 'default'}
          label={`Alerts ${unread}`}
          sx={{
            ...chipSx,
            ...(unread > 0 && {
              borderColor: 'secondary.main',
              boxShadow: `inset 0 0 0 1px ${theme.palette.secondary.main}40`,
            }),
          }}
        />
      </Stack>
    </Box>
  );
};

export default FleetSummaryHeader;
