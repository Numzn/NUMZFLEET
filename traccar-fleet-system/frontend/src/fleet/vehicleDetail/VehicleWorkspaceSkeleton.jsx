import { Box, Skeleton } from '@mui/material';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import useVehicleWorkspaceDensity from './hooks/useVehicleWorkspaceDensity.js';

export default function VehicleWorkspaceSkeleton() {
  const { sectionGap } = useVehicleWorkspaceDensity();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
      <Skeleton width="30%" height={24} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 280px' },
          gap: 2,
        }}
      >
        <Box sx={vehicleWorkspaceCardSx}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Skeleton variant="rounded" width={160} height={120} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="50%" height={28} />
              <Skeleton width="70%" height={20} sx={{ mt: 1 }} />
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rounded" width={72} height={32} />
                ))}
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={40} />
            ))}
          </Box>
        </Box>
        <Skeleton variant="rounded" height={320} />
      </Box>

      <Skeleton variant="rounded" height={48} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(5, 1fr)' }, gap: 2 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" height={100} />
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr 1fr' }, gap: 2 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={240} />
        ))}
      </Box>
    </Box>
  );
}
