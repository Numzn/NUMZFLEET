import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Button } from '@mui/material';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import {
  fetchVehicleFuelHistory,
  fetchVehicleFuelTrends,
} from '../../operationSessions/api/operationSessionsApi.js';
import { exportVehicleFuelReportPdf } from './exportVehicleFuelPdf.js';

export default function FuelReportExportButton({
  vehicle,
  fuel,
  intelligence,
  odometerKm,
  odometerConfidence,
  lastRefill,
  deviceId,
}) {
  const user = useSelector((s) => s.session.user);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!user || deviceId == null || exporting) return;
    setExporting(true);
    try {
      const [trends, historyData] = await Promise.all([
        fetchVehicleFuelTrends(user, deviceId).catch(() => null),
        fetchVehicleFuelHistory(user, deviceId, { limit: 10 }).catch(() => null),
      ]);
      exportVehicleFuelReportPdf({
        vehicle,
        fuel,
        intelligence,
        odometerKm,
        odometerConfidence,
        lastRefill,
        trends,
        history: historyData?.history || [],
        generatedBy: user?.name || user?.email || 'NUMZFLEET',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<PictureAsPdfOutlinedIcon />}
      onClick={handleExport}
      disabled={exporting || deviceId == null}
      sx={{ textTransform: 'none' }}
    >
      {exporting ? 'Generating…' : 'Export PDF'}
    </Button>
  );
}
