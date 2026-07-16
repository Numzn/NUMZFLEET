import { Box, Typography } from '@mui/material';
import FuelCard from './FuelCard.jsx';
import ErbInsightCard from './ErbInsightCard.jsx';
import VehicleFuelColumn from './VehicleFuelColumn.jsx';
import RecentFuelHistoryCard from './RecentFuelHistoryCard.jsx';
import FuelIntelligenceCard from './FuelIntelligenceCard.jsx';
import FuelTrendsCard from './FuelTrendsCard.jsx';
import FuelReportExportButton from './FuelReportExportButton.jsx';
import FuelCsvExportButton from './FuelCsvExportButton.jsx';
import useVehicleWorkspaceDensity from './hooks/useVehicleWorkspaceDensity.js';

export default function VehicleFuelTab({
  vehicle,
  fuel,
  erb,
  deviceId,
  vehicleEngine,
  lastRefill,
}) {
  const { sectionGap } = useVehicleWorkspaceDensity();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h2" sx={{ color: 'var(--color-text-primary)' }}>
          Fuel
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FuelCsvExportButton vehicle={vehicle} deviceId={deviceId} />
          <FuelReportExportButton
            vehicle={vehicle}
            fuel={fuel}
            intelligence={vehicleEngine?.intelligence}
            odometerKm={vehicleEngine?.registry?.odometerKm ?? vehicleEngine?.odometerKm ?? null}
            odometerConfidence={vehicleEngine?.registry?.odometerConfidence ?? null}
            lastRefill={lastRefill}
            deviceId={deviceId}
          />
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <FuelCard fuel={fuel} />
        <ErbInsightCard
          erb={erb}
          vehicleSpec={vehicle?.vehicleSpec}
          estimatedFillCostZmw={fuel?.estimatedFillCostZmw ?? vehicleEngine?.fuelSnapshot?.estimatedFillCostZmw}
        />
      </Box>
      <VehicleFuelColumn deviceId={deviceId} />
      <FuelIntelligenceCard fuel={fuel} intelligence={vehicleEngine?.intelligence} />
      <FuelTrendsCard deviceId={deviceId} />
      <RecentFuelHistoryCard deviceId={deviceId} />
    </Box>
  );
}
