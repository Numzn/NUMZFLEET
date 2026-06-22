import { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
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
import { formatLitres, formatZmw } from './utils/formatters.js';
import { deriveInvoiceStage, INVOICE_STAGE_LABEL, invoiceStageColor } from './utils/operationDayUtils.js';

const STATUS_CHIP = {
  matched: { label: 'Matched', color: 'success' },
  variance: { label: 'Variance', color: 'error' },
  pending: { label: 'Pending', color: 'default' },
};

function invoiceTitle(invoice) {
  if (invoice.invoiceNumber) return invoice.invoiceNumber;
  if (invoice.attachmentUrl) return 'Station invoice';
  return 'Smart Invoice';
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
  const summary = todayDetails?.invoiceSummary;
  const sessionActualL = Number(todayDetails?.totalActualFuel || 0);
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

  const summaryChip = summary && summary.count > 0 ? STATUS_CHIP[summary.status] || STATUS_CHIP.pending : null;
  const awaitingExtraction = (summary?.pendingExtraction || 0) > 0;

  return (
    <Stack spacing={RUNTIME_STACK_GAP}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack spacing={0.75}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" fontWeight={800}>Day reconciliation</Typography>
            {summaryChip && <Chip size="small" label={summaryChip.label} color={summaryChip.color} />}
          </Box>
          <Typography variant="body2" color="text.secondary">
            Upload station invoice photos. Litres and cost are extracted automatically when the photo is clear.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip size="small" variant="outlined" label={`Dispensed ${formatLitres(sessionActualL)}`} />
            <Chip size="small" variant="outlined" label={`Invoiced ${formatLitres(summary?.totalInvoiceLitres || 0)}`} />
            {summary?.varianceLitres != null && (
              <Chip
                size="small"
                variant="outlined"
                color={summary.status === 'variance' ? 'error' : 'default'}
                label={`Variance ${summary.varianceLitres >= 0 ? '+' : ''}${summary.varianceLitres.toFixed(1)} L`}
              />
            )}
            <Chip size="small" variant="outlined" label={`${summary?.count || 0} attachment${(summary?.count || 0) === 1 ? '' : 's'}`} />
            {awaitingExtraction && (
              <Chip size="small" variant="outlined" color="warning" label={`${summary.pendingExtraction} awaiting extraction`} />
            )}
          </Box>
        </Stack>
      </Paper>

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
                {invoice.totalCost != null ? ` · ${formatZmw(invoice.totalCost)}` : ''}
              </Typography>
            )}

            {isEditing ? (
              <>
                <Divider sx={{ my: 1.25 }} />
                <SmartInvoiceAttachment
                  invoice={invoice}
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
