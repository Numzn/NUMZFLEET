import { useState, useEffect, useCallback } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { vehicleDashboardCardSx } from '../dashboardCardSx.js';

export default function VehicleNotesFooter({
  notes,
  onSave,
  readOnly = false,
  saving = false,
}) {
  const [draft, setDraft] = useState(notes || '');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(notes || '');
  }, [notes]);

  const handleBlur = useCallback(async () => {
    setEditing(false);
    if (readOnly || draft === (notes || '')) return;
    await onSave?.(draft);
  }, [draft, notes, onSave, readOnly]);

  return (
    <Box sx={[vehicleDashboardCardSx, { mt: 2 }]}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Notes
        </Typography>
        {!readOnly && <EditOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
      </Box>

      {readOnly ? (
        <Typography variant="body2" color={notes ? 'text.primary' : 'text.secondary'}>
          {notes || 'No notes yet. Vehicle notes will be available after backend sync.'}
        </Typography>
      ) : (
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          placeholder="Add notes about this vehicle…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={handleBlur}
          disabled={saving}
          size="small"
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'var(--surface-workspace)' } }}
        />
      )}
      {editing && !readOnly && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Changes save when you leave the field.
        </Typography>
      )}
    </Box>
  );
}
