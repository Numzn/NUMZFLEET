import { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { RUNTIME_STACK_GAP } from '../common/styles/runtimeDensity';
import { useManager } from '../common/util/permissions';
import { fuelApiErrorMessage } from '../fleet/vehiclesApi.js';
import useTodayOperation from './hooks/useTodayOperation.js';
import { replaceOperationInvoiceFile, uploadOperationInvoice } from './api/operationSessionsApi.js';
import SmartInvoiceAttachment from './components/SmartInvoiceAttachment.jsx';
import OperationVehicleLabel from './components/OperationVehicleLabel.jsx';
import { formatK, formatLitres, vehicleCountLabel } from './utils/formatters.js';
import {
  deriveInvoiceStage, INVOICE_STAGE_LABEL, invoiceStageColor, isRefuelComplete,
} from './utils/operationDayUtils.js';

function invoiceTitle(invoice) {
  if (invoice.invoiceNumber) return invoice.invoiceNumber;
  if (invoice.attachmentUrl) return 'Station invoice';
  return 'Smart Invoice';
}

// Matches the SummaryStat grammar already used by Plan/Fueling/Review summary cards.
function SummaryStat({ value, label, warn = false }) {
  return (
    <Box sx={{ flex: 1, textAlign: 'center' }}>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: warn ? 'warning.main' : 'primary.main', lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ letterSpacing: 0.4, color: 'text.secondary', textTransform: 'uppercase' }}>
        {label}
      </Typography>
    </Box>
  );
}

export default function SmartInvoicesPage() {
  const user = useSelector((state) => state.session.user);
  const isManager = useManager();
  const {
    todayOperation, todayDetails, loading, error, reload,
  } = useTodayOperation();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const sessionId = todayOperation?.id;
  const status = String(
    todayDetails?.effectiveStatus || todayOperation?.effectiveStatus || todayOperation?.status || '',
  ).toLowerCase();
  const invoices = todayDetails?.invoices || [];
  const refuels = todayDetails?.refuels || [];
  const fueledRefuels = refuels.filter(isRefuelComplete);
  const refuelsById = new Map(refuels.map((r) => [Number(r.id), r]));
  const coveredRefuelIdSet = new Set(invoices.flatMap((i) => i.coveredRefuelIds || []).map(Number));
  const coveredCount = fueledRefuels.filter((r) => coveredRefuelIdSet.has(Number(r.id))).length;
  const uncoveredCount = fueledRefuels.length - coveredCount;
  const isLocked = status === 'locked';
  const canEdit = isManager && !isLocked && status === 'approved';

  const handleCreate = useCallback(async (payload) => {
    setSaving(true);
    setFormError('');
    try {
      await uploadOperationInvoice(user, sessionId, payload.file, payload);
      setAdding(false);
      await reload();
    } catch (e) {
      setFormError(fuelApiErrorMessage(e, 'Failed to attach invoice'));
    } finally {
      setSaving(false);
    }
  }, [reload, sessionId, user]);

  const handleUpdate = useCallback(async (invoiceId, payload) => {
    setSaving(true);
    setFormError('');
    try {
      await replaceOperationInvoiceFile(user, sessionId, invoiceId, payload.file, payload);
      setEditingId(null);
      await reload();
    } catch (e) {
      setFormError(fuelApiErrorMessage(e, 'Failed to replace invoice file'));
    } finally {
      setSaving(false);
    }
  }, [reload, sessionId, user]);

  if (loading && !todayDetails) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{fuelApiErrorMessage(error, 'Failed to load Fueling Day')}</Alert>;
  }

  if (!sessionId) {
    return <Alert severity="info">No Fueling Day yet. Prepare one before attaching invoices.</Alert>;
  }

  if (status === 'draft') {
    return <Alert severity="info">Start the Fueling Day before attaching Smart Invoices.</Alert>;
  }

  const coverageChip = fueledRefuels.length === 0
    ? null
    : uncoveredCount === 0
      ? { label: 'All Covered', color: 'success' }
      : { label: `${uncoveredCount} Uncovered`, color: 'warning' };

  return (
    <Stack spacing={RUNTIME_STACK_GAP}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Typography variant="overline" sx={{ letterSpacing: 0.6, fontWeight: 800 }}>
              Coverage
            </Typography>
            {coverageChip && <Chip size="small" label={coverageChip.label} color={coverageChip.color} />}
          </Box>

          <Divider sx={{ my: 0.75 }} />

          <Box sx={{ display: 'flex' }}>
            <SummaryStat value={fueledRefuels.length} label="Fueled" />
            <SummaryStat value={coveredCount} label="Covered" />
            <SummaryStat value={invoices.length} label="Attachments" />
          </Box>

          <Divider sx={{ my: 0.75 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">Uncovered vehicles</Typography>
            <Typography
              variant="body2"
              fontWeight={800}
              color={uncoveredCount > 0 ? 'warning.main' : 'text.primary'}
            >
              {uncoveredCount}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="body2" color="text.secondary">
        Attach station receipt photos and select which fueled vehicles each one covers.
      </Typography>

      {canEdit && !adding && (
        <Box>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setAdding(true); setFormError(''); }}
            sx={{ textTransform: 'none' }}
          >
            Attach Smart Invoice
          </Button>
        </Box>
      )}

      {adding && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Attach Smart Invoice</Typography>
          <SmartInvoiceAttachment
            refuels={fueledRefuels}
            saving={saving}
            error={formError}
            onSubmit={handleCreate}
            onCancel={() => { setAdding(false); setFormError(''); }}
          />
        </Paper>
      )}

      {invoices.length === 0 && !adding && (
        <Alert severity="info">No Smart Invoice attachments yet for this Fueling Day.</Alert>
      )}

      {invoices.map((invoice) => {
        const stage = deriveInvoiceStage(invoice);
        const chip = { label: INVOICE_STAGE_LABEL[stage], color: invoiceStageColor(stage) };
        const isEditing = editingId === invoice.id;
        return (
          <Paper key={invoice.id} variant="outlined" sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {invoiceTitle(invoice)}
              </Typography>
              <Chip size="small" label={chip.label} color={chip.color} variant="outlined" />
            </Box>

            {invoice.attachmentUrl && (
              <Link
                href={invoice.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 0.75,
                  fontSize: '0.875rem',
                }}
              >
                View invoice file
                <OpenInNewIcon sx={{ fontSize: '0.9rem' }} />
              </Link>
            )}

            {!invoice.extractionPending && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {`Total ${formatLitres(invoice.totalLitres)}`}
                {invoice.totalCost != null ? ` · ${formatK(invoice.totalCost)}` : ''}
              </Typography>
            )}

            <Box sx={{ mt: 0.75 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: '12px' }}>
                {`COVERS · ${vehicleCountLabel((invoice.coveredRefuelIds || []).length)}`}
              </Typography>
              <Stack sx={{ mt: 0.25 }} spacing={0.25}>
                {(invoice.coveredRefuelIds || []).map((refuelId) => {
                  const refuel = refuelsById.get(Number(refuelId));
                  if (!refuel) return null;
                  return (
                    <OperationVehicleLabel
                      key={refuelId}
                      deviceId={refuel.vehicleId}
                      titleVariant="body2"
                      titleWeight={600}
                      compact
                    />
                  );
                })}
              </Stack>
            </Box>

            {isEditing ? (
              <>
                <Divider sx={{ my: 1.25 }} />
                <SmartInvoiceAttachment
                  invoice={invoice}
                  refuels={fueledRefuels}
                  saving={saving}
                  error={formError}
                  onSubmit={(payload) => handleUpdate(invoice.id, payload)}
                  onCancel={() => { setEditingId(null); setFormError(''); }}
                />
              </>
            ) : (
              canEdit && (
                <Box sx={{ mt: 0.75 }}>
                  <Button
                    size="small"
                    onClick={() => { setEditingId(invoice.id); setFormError(''); }}
                    sx={{ textTransform: 'none' }}
                  >
                    Replace file
                  </Button>
                </Box>
              )
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}
