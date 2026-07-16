import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Button } from '@mui/material';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { fetchVehicleFuelHistory } from '../../operationSessions/api/operationSessionsApi.js';
import { exportVehicleFuelHistoryCsv } from './exportVehicleFuelCsv.js';

export default function FuelCsvExportButton({ vehicle, deviceId }) {
  const user = useSelector((s) => s.session.user);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!user || deviceId == null || exporting) return;
    setExporting(true);
    try {
      const data = await fetchVehicleFuelHistory(user, deviceId, { limit: 50 }).catch(() => null);
      exportVehicleFuelHistoryCsv({ vehicle, history: data?.history || [] });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<TableChartOutlinedIcon />}
      onClick={handleExport}
      disabled={exporting || deviceId == null}
      sx={{ textTransform: 'none' }}
    >
      {exporting ? 'Generating…' : 'Export CSV'}
    </Button>
  );
}
