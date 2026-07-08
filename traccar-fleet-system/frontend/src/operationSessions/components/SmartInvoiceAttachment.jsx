import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { formatLitres } from '../utils/formatters.js';
import OperationVehicleLabel from './OperationVehicleLabel.jsx';

/**
 * Attach a Smart Invoice: a photo/PDF of the receipt plus which fueled vehicles
 * (refuel rows) from this session it covers. Evidence only — no OCR, no totals.
 */
export default function SmartInvoiceAttachment({
  invoice = null,
  refuels = [],
  disabled = false,
  saving = false,
  error = '',
  onSubmit,
  onCancel,
}) {
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedRefuelIds, setSelectedRefuelIds] = useState(
    () => new Set((invoice?.coveredRefuelIds || []).map(Number)),
  );

  const resetInputs = () => {
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelected = (selected) => {
    if (!selected) return;
    setFile(selected);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const toggleRefuel = (refuelId) => {
    setSelectedRefuelIds((prev) => {
      const next = new Set(prev);
      if (next.has(refuelId)) next.delete(refuelId);
      else next.add(refuelId);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!file || selectedRefuelIds.size === 0) return;
    onSubmit({
      file,
      refuelIds: Array.from(selectedRefuelIds),
    });
  };

  const busy = disabled || saving;
  const canSubmit = !busy && !!file && selectedRefuelIds.size > 0;

  return (
    <Stack spacing={1.25}>
      <Typography variant="body2" color="text.secondary">
        Take a photo of the station invoice or choose a file, then select which fueled vehicles it covers.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="outlined"
          startIcon={<PhotoCameraIcon />}
          onClick={() => cameraInputRef.current?.click()}
          disabled={busy}
          sx={{ textTransform: 'none' }}
        >
          Take photo
        </Button>
        <Button
          variant="outlined"
          startIcon={<UploadFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          sx={{ textTransform: 'none' }}
        >
          Choose file
        </Button>
      </Stack>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handleFileSelected(e.target.files?.[0]);
          resetInputs();
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          handleFileSelected(e.target.files?.[0]);
          resetInputs();
        }}
      />

      {previewUrl && (
        <Box
          component="img"
          src={previewUrl}
          alt="Invoice preview"
          sx={{
            maxWidth: '100%',
            maxHeight: 220,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            objectFit: 'contain',
          }}
        />
      )}

      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: '12px' }}>
          COVERS
        </Typography>
        {refuels.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            No fueled vehicles yet on this Fueling Day.
          </Typography>
        ) : (
          <Stack sx={{ mt: 0.5 }}>
            {refuels.map((refuel) => (
              <Box
                key={refuel.id}
                onClick={() => (busy ? null : toggleRefuel(refuel.id))}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  py: 0.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                  cursor: busy ? 'default' : 'pointer',
                }}
              >
                <Checkbox
                  checked={selectedRefuelIds.has(refuel.id)}
                  onChange={() => toggleRefuel(refuel.id)}
                  disabled={busy}
                  size="small"
                />
                <OperationVehicleLabel
                  deviceId={refuel.vehicleId}
                  titleVariant="body2"
                  titleWeight={700}
                  secondarySx={{ fontSize: '13px' }}
                />
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '12px' }}>
                  {formatLitres(refuel.actualFuelLitres)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant="contained"
          size="small"
          onClick={handleSubmit}
          disabled={!canSubmit}
          sx={{ textTransform: 'none' }}
        >
          {saving ? 'Uploading…' : invoice ? 'Replace invoice' : 'Attach'}
        </Button>
        {saving && <CircularProgress size={18} />}
        {onCancel && (
          <Button size="small" onClick={onCancel} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
