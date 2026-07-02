import { Box, Typography } from '@mui/material';
import FuelCard from './FuelCard.jsx';
import ErbInsightCard from './ErbInsightCard.jsx';
import VehicleFuelColumn from './VehicleFuelColumn.jsx';
import useVehicleWorkspaceDensity from './hooks/useVehicleWorkspaceDensity.js';

export default function VehicleFuelTab({
  vehicle,
  fuel,
  erb,
  deviceId,
  fuelPerformance,
  fuelPerformanceLoading,
  vehicleEngine,
}) {
  const { sectionGap } = useVehicleWorkspaceDensity();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
      <Typography variant="h2" sx={{ color: 'var(--color-text-primary)' }}>
        Fuel
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <FuelCard fuel={fuel} />
        <ErbInsightCard
          erb={erb}
          vehicleSpec={vehicle?.vehicleSpec}
          estimatedFillCostZmw={fuel?.estimatedFillCostZmw ?? vehicleEngine?.fuelSnapshot?.estimatedFillCostZmw}
        />
      </Box>
      <VehicleFuelColumn
        deviceId={deviceId}
        fuel={fuel}
        erb={erb}
        fuelPerformance={fuelPerformance}
        fuelPerformanceLoading={fuelPerformanceLoading}
        odometerKm={vehicleEngine?.registry?.odometerKm ?? vehicleEngine?.odometerKm ?? null}
        odometerConfidence={vehicleEngine?.registry?.odometerConfidence ?? null}
        intelligence={vehicleEngine?.intelligence}
      />
    </Box>
  );
}
