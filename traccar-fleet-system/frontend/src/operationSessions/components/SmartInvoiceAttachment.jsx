import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { extractInvoiceFromImage } from '../utils/extractInvoiceFromImage.js';

/**
 * Attach a Smart Invoice by uploading a photo or file. OCR extracts litres and cost.
 */
export default function SmartInvoiceAttachment({
  invoice = null,
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
  const [extracting, setExtracting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState('');
  const [label, setLabel] = useState(invoice?.invoiceNumber || '');
  const [totalLitres, setTotalLitres] = useState(
    invoice?.totalLitres != null ? String(invoice.totalLitres) : '',
  );
  const [totalCost, setTotalCost] = useState(
    invoice?.totalCost != null ? String(invoice.totalCost) : '',
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const resetInputs = () => {
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelected = async (selected) => {
    if (!selected) return;
    setFile(selected);
    setOcrError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selected));

    if (!/^image\//.test(selected.type)) {
      setOcrError('PDF uploaded — enter litres and cost manually if needed.');
      return;
    }

    setExtracting(true);
    setOcrProgress(0);
    try {
      const extracted = await extractInvoiceFromImage(selected, {
        onProgress: setOcrProgress,
      });
      if (extracted.invoiceNumber && !label) setLabel(extracted.invoiceNumber);
      if (extracted.totalLitres != null) setTotalLitres(String(extracted.totalLitres));
      if (extracted.totalCost != null) setTotalCost(String(extracted.totalCost));
      if (extracted.totalLitres == null && extracted.totalCost == null) {
        setOcrError('Could not read totals — check the photo or enter them below.');
      }
    } catch {
      setOcrError('OCR failed — you can still attach the file and enter totals manually.');
    } finally {
      setExtracting(false);
      setOcrProgress(0);
    }
  };

  const handleSubmit = () => {
    if (!file) return;
    onSubmit({
      file,
      invoiceNumber: label.trim() || undefined,
      totalLitres: totalLitres.trim() ? Number(totalLitres) : undefined,
      totalCost: totalCost.trim() ? Number(totalCost) : undefined,
    });
  };

  const busy = disabled || saving || extracting;

  return (
    <Stack spacing={1.25}>
      <Typography variant="body2" color="text.secondary">
        Take a photo of the station invoice or choose a file. Litres and cost are read automatically when possible.
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

      {extracting && (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">Reading invoice…</Typography>
          <LinearProgress variant={ocrProgress > 0 ? 'determinate' : 'indeterminate'} value={ocrProgress} />
        </Stack>
      )}

      {ocrError && !extracting && (
        <Alert severity="warning">{ocrError}</Alert>
      )}

      <TextField
        label="Receipt label (optional)"
        placeholder="e.g. Puma receipt #1234"
        size="small"
        fullWidth
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={busy}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          label="Total litres"
          type="number"
          size="small"
          fullWidth
          value={totalLitres}
          onChange={(e) => setTotalLitres(e.target.value)}
          disabled={busy}
          inputProps={{ min: 0, step: 0.1 }}
        />
        <TextField
          label="Total cost (ZMW)"
          type="number"
          size="small"
          fullWidth
          value={totalCost}
          onChange={(e) => setTotalCost(e.target.value)}
          disabled={busy}
          inputProps={{ min: 0, step: 0.01 }}
        />
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant="contained"
          size="small"
          onClick={handleSubmit}
          disabled={busy || !file}
          sx={{ textTransform: 'none' }}
        >
          {saving ? 'Uploading…' : invoice ? 'Replace invoice' : 'Attach invoice'}
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
