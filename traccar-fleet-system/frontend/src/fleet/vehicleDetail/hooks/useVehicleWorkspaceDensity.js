import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

/**
 * Responsive density for vehicle workspace (scaled desktop layout, no tab stacking).
 */
export default function useVehicleWorkspaceDensity() {
  const theme = useTheme();
  const tiny = useMediaQuery(theme.breakpoints.down(400));
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tablet = useMediaQuery(theme.breakpoints.down('md'));
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));

  return {
    tiny,
    mobile,
    tablet,
    desktop,
    sectionGap: desktop ? 3 : tablet ? 2.5 : 2,
    cardPadding: desktop ? 3 : mobile ? 2 : 2,
    avatarSize: tiny ? 40 : mobile ? 48 : 56,
    vehicleNameSize: mobile ? '1rem' : '1.25rem',
    metricValueSize: mobile ? '1.125rem' : '1.5rem',
    metricLabelSize: mobile ? '0.625rem' : '0.6875rem',
    metricLabelShort: tiny,
    commandsIconOnly: tiny,
    metricsGridGap: desktop ? 3 : mobile ? 1.5 : 2,
    operationsGridColumns: tablet ? '1fr' : '1fr 1fr',
    diagnosticsColumns: {
      xs: '1fr',
      sm: 'repeat(2, 1fr)',
      lg: 'repeat(4, 1fr)',
    },
  };
}
