import { Box, Skeleton } from '@mui/material';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import useVehicleWorkspaceDensity from './hooks/useVehicleWorkspaceDensity.js';

export default function VehicleWorkspaceSkeleton() {
  const { sectionGap, operationsGridColumns, diagnosticsColumns } = useVehicleWorkspaceDensity();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
      <Box sx={vehicleWorkspaceCardSx}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
            <Skeleton variant="circular" width={56} height={56} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="40%" height={28} />
              <Skeleton width="60%" height={20} sx={{ mt: 1 }} />
              <Skeleton width="30%" height={18} sx={{ mt: 0.5 }} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton variant="rounded" width={72} height={32} />
            <Skeleton variant="rounded" width={72} height={32} />
          </Box>
        </Box>
        <Skeleton width="50%" height={20} sx={{ mx: 'auto', mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={100} />
          ))}
        </Box>
        <Skeleton width="70%" height={20} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: operationsGridColumns, gap: 2 }}>
        <Skeleton variant="rounded" height={280} />
        <Skeleton variant="rounded" height={280} />
      </Box>

      <Skeleton variant="rounded" height={48} />
      <Box sx={{ display: 'grid', gridTemplateColumns: diagnosticsColumns, gap: 2 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={140} />
        ))}
      </Box>
    </Box>
  );
}
