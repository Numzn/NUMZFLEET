import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Chip,
  FormControl,
  TextField,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DocumentScannerOutlinedIcon from '@mui/icons-material/DocumentScannerOutlined';
import { vehicleDashboardCardSx } from './dashboardCardSx.js';
import {
  deleteVehicleDocument,
  deleteVehicleCompliance,
  createVehicleCompliance,
  fetchVehicleCompliance,
  fetchVehicleDocuments,
  updateVehicleCompliance,
  uploadVehicleDocument,
  runVehicleDocumentOcr,
} from '../vehiclesApi.js';

const DOCUMENT_CATEGORIES = [
  { value: 'registration', label: 'Registration' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'other', label: 'Other' },
];

const COMPLIANCE_TYPES = [
  'INSURANCE',
  'ROAD_TAX',
  'FITNESS',
  'FIRE_EXTINGUISHER',
  'INSPECTION',
  'PERMIT',
  'LICENSE',
];

export default function VehicleDocumentsPanel({ fleetVehicleId }) {
  const user = useSelector((s) => s.session.user);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('other');
  const [complianceItems, setComplianceItems] = useState([]);
  const [newComplianceType, setNewComplianceType] = useState('INSURANCE');
  const [newComplianceDueDate, setNewComplianceDueDate] = useState('');
  const [newComplianceLeadDays, setNewComplianceLeadDays] = useState(30);
  const [newComplianceDocumentId, setNewComplianceDocumentId] = useState('');
  const [scanningDocId, setScanningDocId] = useState(null);

  const ocrStatusLabel = (status) => {
    if (!status) return null;
    if (status === 'completed') return 'Scanned';
    if (status === 'processing') return 'Scanning…';
    if (status === 'pending') return 'Queued';
    if (status === 'failed') return 'Scan failed';
    if (status === 'empty') return 'No text found';
    return status;
  };

  const ocrStatusColor = (status) => {
    if (status === 'completed') return 'success';
    if (status === 'processing' || status === 'pending') return 'info';
    if (status === 'failed') return 'error';
    return 'default';
  };

  const reload = useCallback(async () => {
    if (!user || !fleetVehicleId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [rows, compliance] = await Promise.all([
        fetchVehicleDocuments(user, fleetVehicleId),
        fetchVehicleCompliance(user, fleetVehicleId),
      ]);
      setDocuments(Array.isArray(rows) ? rows : []);
      setComplianceItems(Array.isArray(compliance) ? compliance : []);
    } catch (err) {
      setError(err?.message || 'Failed to load documents');
      setDocuments([]);
      setComplianceItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, fleetVehicleId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user || !fleetVehicleId) return;
    setUploading(true);
    setError(null);
    try {
      await uploadVehicleDocument(user, fleetVehicleId, file, {
        title: file.name,
        category,
      });
      await reload();
    } catch (err) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleScanDocument = async (docId) => {
    if (!user || !fleetVehicleId) return;
    setScanningDocId(docId);
    setError(null);
    try {
      const updated = await runVehicleDocumentOcr(user, fleetVehicleId, docId);
      setDocuments((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err?.message || 'Document scan failed');
      await reload();
    } finally {
      setScanningDocId(null);
    }
  };

  const handleApplyOcrSuggestion = (doc, item) => {
    const facts = doc?.ocr?.facts;
    if (!facts) return;
    const suggestion = item ?? {
      type: facts.suggestedComplianceType,
      dueDate: facts.suggestedExpiryDate,
    };
    if (suggestion.type) {
      setNewComplianceType(suggestion.type);
    }
    if (suggestion.dueDate) {
      setNewComplianceDueDate(suggestion.dueDate);
    }
    if (doc?.id) {
      setNewComplianceDocumentId(String(doc.id));
    }
  };

  const handleDelete = async (docId) => {
    if (!user || !fleetVehicleId) return;
    try {
      await deleteVehicleDocument(user, fleetVehicleId, docId);
      await reload();
    } catch (err) {
      setError(err?.message || 'Delete failed');
    }
  };

  const handleCreateCompliance = async () => {
    if (!user || !fleetVehicleId) return;
    setError(null);
    try {
      await createVehicleCompliance(user, fleetVehicleId, {
        type: newComplianceType,
        dueDate: newComplianceDueDate || null,
        reminderLeadDays: Number(newComplianceLeadDays) || 30,
        documentId: newComplianceDocumentId ? Number(newComplianceDocumentId) : null,
      });
      setNewComplianceDueDate('');
      setNewComplianceDocumentId('');
      await reload();
    } catch (err) {
      setError(err?.message || 'Failed to create compliance item');
    }
  };

  const handleDeleteCompliance = async (complianceId) => {
    if (!user || !fleetVehicleId) return;
    try {
      await deleteVehicleCompliance(user, fleetVehicleId, complianceId);
      await reload();
    } catch (err) {
      setError(err?.message || 'Failed to delete compliance item');
    }
  };

  const handleLinkDocument = async (complianceId, documentId) => {
    if (!user || !fleetVehicleId) return;
    try {
      await updateVehicleCompliance(user, fleetVehicleId, complianceId, {
        documentId: documentId ? Number(documentId) : null,
      });
      await reload();
    } catch (err) {
      setError(err?.message || 'Failed to update evidence link');
    }
  };

  const categoryLabel = (value) => DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label || value;

  return (
    <Box sx={vehicleDashboardCardSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h2" sx={{ color: 'var(--color-text-primary)', fontSize: '1.25rem' }}>
          Documents
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="doc-cat-label">Category</InputLabel>
            <Select
              labelId="doc-cat-label"
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            component="label"
            variant="outlined"
            size="small"
            startIcon={<UploadFileOutlinedIcon />}
            disabled={uploading || !fleetVehicleId}
          >
            Upload
            <input type="file" hidden accept="image/*,.pdf" onChange={handleUpload} />
          </Button>
        </Box>
      </Box>

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}

      {loading && (
        <Typography variant="body2" color="text.secondary">Loading documents…</Typography>
      )}

      {!loading && documents.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No documents uploaded for this vehicle yet.
        </Typography>
      )}

      {!loading && documents.length > 0 && (
        <List dense disablePadding>
          {documents.map((doc) => {
            const facts = doc.ocr?.facts;
            const scanning = scanningDocId === doc.id || doc.ocr?.status === 'processing';
            return (
              <ListItem
                key={doc.id}
                sx={{ px: 0, alignItems: 'flex-start', flexDirection: 'column' }}
              >
                <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-start', gap: 1 }}>
                  <ListItemText
                    sx={{ flex: 1, m: 0 }}
                    primary={(
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <span>{doc.title}</span>
                        {doc.ocr?.status ? (
                          <Chip
                            size="small"
                            label={ocrStatusLabel(doc.ocr.status)}
                            color={ocrStatusColor(doc.ocr.status)}
                            variant={doc.ocr.status === 'completed' ? 'filled' : 'outlined'}
                          />
                        ) : null}
                      </Box>
                    )}
                    secondary={[
                      categoryLabel(doc.category),
                      doc.createdAt
                        ? new Date(doc.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
                        : null,
                    ].filter(Boolean).join(' · ')}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <Button
                      size="small"
                      startIcon={<DocumentScannerOutlinedIcon />}
                      onClick={() => handleScanDocument(doc.id)}
                      disabled={scanning || uploading}
                    >
                      {scanning ? 'Scanning…' : 'Scan'}
                    </Button>
                    {doc.url && (
                      <Button size="small" href={doc.url} target="_blank" rel="noopener noreferrer">
                        View
                      </Button>
                    )}
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(doc.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                {(facts?.suggestedComplianceItems?.length > 0
                  || facts?.suggestedExpiryDate
                  || facts?.suggestedComplianceType) ? (
                  <Box sx={{ width: '100%', mt: 1, pl: 0 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                      OCR suggestions (review before saving)
                      {facts.documentProfile === 'zambian_unified_disc'
                        ? ' — unified ROAD TAX / CES disc'
                        : ''}
                    </Typography>
                    {(facts.suggestedComplianceItems?.length
                      ? facts.suggestedComplianceItems
                      : [{
                        type: facts.suggestedComplianceType,
                        dueDate: facts.suggestedExpiryDate,
                        label: 'Suggested expiry',
                      }].filter((row) => row.type && row.dueDate)
                    ).map((item) => (
                      <Box
                        key={`${doc.id}-${item.type}-${item.dueDate}`}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}
                      >
                        <Typography variant="body2">
                          {item.type.replaceAll('_', ' ')} · due {item.dueDate}
                          {item.source === 'inferred' ? ' (review)' : ''}
                        </Typography>
                        <Button
                          size="small"
                          sx={{ textTransform: 'none' }}
                          onClick={() => handleApplyOcrSuggestion(doc, item)}
                        >
                          Use in form
                        </Button>
                      </Box>
                    ))}
                    {facts.detectedDocumentNumbers?.length ? (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        Ref: {facts.detectedDocumentNumbers.slice(0, 3).join(', ')}
                      </Typography>
                    ) : null}
                  </Box>
                ) : null}
                {doc.ocr?.status === 'failed' && facts?.error ? (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {facts.error}
                  </Typography>
                ) : null}
              </ListItem>
            );
          })}
        </List>
      )}

      <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Compliance
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Compliance drives due status; documents are optional evidence attachments.
        </Typography>

        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr 1fr auto' }, mb: 2 }}>
          <FormControl size="small">
            <InputLabel id="compliance-type-label">Type</InputLabel>
            <Select
              labelId="compliance-type-label"
              label="Type"
              value={newComplianceType}
              onChange={(e) => setNewComplianceType(e.target.value)}
            >
              {COMPLIANCE_TYPES.map((type) => (
                <MenuItem key={type} value={type}>{type.replaceAll('_', ' ')}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="date"
            label="Due date"
            value={newComplianceDueDate}
            onChange={(e) => setNewComplianceDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="number"
            label="Lead days"
            value={newComplianceLeadDays}
            onChange={(e) => setNewComplianceLeadDays(e.target.value)}
            inputProps={{ min: 0, max: 3650 }}
          />
          <FormControl size="small">
            <InputLabel id="compliance-doc-label">Evidence</InputLabel>
            <Select
              labelId="compliance-doc-label"
              label="Evidence"
              value={newComplianceDocumentId}
              onChange={(e) => setNewComplianceDocumentId(e.target.value)}
            >
              <MenuItem value="">None</MenuItem>
              {documents.map((doc) => (
                <MenuItem key={doc.id} value={String(doc.id)}>{doc.title}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleCreateCompliance}>
            Add
          </Button>
        </Box>

        {!loading && complianceItems.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No compliance items configured yet.
          </Typography>
        )}

        {!loading && complianceItems.length > 0 && (
          <List dense disablePadding>
            {complianceItems.map((item) => (
              <ListItem
                key={item.id}
                sx={{ px: 0 }}
                secondaryAction={(
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel id={`link-doc-${item.id}`}>Evidence</InputLabel>
                      <Select
                        labelId={`link-doc-${item.id}`}
                        label="Evidence"
                        value={item.documentId != null ? String(item.documentId) : ''}
                        onChange={(e) => handleLinkDocument(item.id, e.target.value)}
                      >
                        <MenuItem value="">None</MenuItem>
                        {documents.map((doc) => (
                          <MenuItem key={doc.id} value={String(doc.id)}>{doc.title}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteCompliance(item.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              >
                <ListItemText
                  primary={item.type.replaceAll('_', ' ')}
                  secondary={[
                    item.status,
                    item.dueDate ? `Due ${item.dueDate}` : 'No due date',
                    `Lead ${item.reminderLeadDays}d`,
                  ].join(' · ')}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
