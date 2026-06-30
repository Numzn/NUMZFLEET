import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  FormControl,
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
import { vehicleDashboardCardSx } from './dashboardCardSx.js';
import {
  deleteVehicleDocument,
  fetchVehicleDocuments,
  uploadVehicleDocument,
} from '../vehiclesApi.js';

const DOCUMENT_CATEGORIES = [
  { value: 'registration', label: 'Registration' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'other', label: 'Other' },
];

export default function VehicleDocumentsPanel({ fleetVehicleId }) {
  const user = useSelector((s) => s.session.user);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('other');

  const reload = useCallback(async () => {
    if (!user || !fleetVehicleId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchVehicleDocuments(user, fleetVehicleId);
      setDocuments(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err?.message || 'Failed to load documents');
      setDocuments([]);
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

  const handleDelete = async (docId) => {
    if (!user || !fleetVehicleId) return;
    try {
      await deleteVehicleDocument(user, fleetVehicleId, docId);
      await reload();
    } catch (err) {
      setError(err?.message || 'Delete failed');
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
          {documents.map((doc) => (
            <ListItem
              key={doc.id}
              secondaryAction={(
                <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(doc.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
              sx={{ px: 0 }}
            >
              <ListItemText
                primary={doc.title}
                secondary={[
                  categoryLabel(doc.category),
                  doc.createdAt
                    ? new Date(doc.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
                    : null,
                ].filter(Boolean).join(' · ')}
              />
              {doc.url && (
                <Button size="small" href={doc.url} target="_blank" rel="noopener noreferrer" sx={{ ml: 1 }}>
                  View
                </Button>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
