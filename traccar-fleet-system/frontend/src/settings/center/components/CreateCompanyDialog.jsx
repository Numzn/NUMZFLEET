import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Typography, Alert, Stack, Divider, IconButton, InputAdornment,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { provisionCompany } from '../platformCompaniesApi.js';

const EMPTY_FORM = {
  companyName: '',
  companySlug: '',
  contactEmail: '',
  contactPhone: '',
  adminName: '',
  adminEmail: '',
  adminPhone: '',
  adminPassword: '',
};

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseApiError(e) {
  try {
    return JSON.parse(e.message)?.error || e.message;
  } catch {
    return e.message || 'Failed to create company';
  }
}

export default function CreateCompanyDialog({ open, onClose, onCreated }) {
  const currentUser = useSelector((state) => state.session.user);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const set = (field) => (e) => {
    const { value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'companyName' && !slugTouched) {
        next.companySlug = slugify(value);
      }
      return next;
    });
    if (field === 'companySlug') setSlugTouched(true);
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setError('');
    setResult(null);
    onClose();
  };

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const created = await provisionCompany(currentUser, {
        company: {
          name: form.companyName,
          slug: form.companySlug,
          contactEmail: form.contactEmail || undefined,
          contactPhone: form.contactPhone || undefined,
        },
        admin: {
          name: form.adminName,
          email: form.adminEmail,
          phone: form.adminPhone || undefined,
          password: form.adminPassword,
        },
      });
      setResult(created);
      onCreated();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.companyName && form.companySlug && form.adminName
    && form.adminEmail && form.adminPassword.length >= 6;

  if (result) {
    return (
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>Company created</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            {result.company.name} is active. Hand these credentials to the new admin now —
            the password will not be shown again.
          </Alert>
          <Stack spacing={1.5}>
            <TextField label="Admin email" value={result.admin.email} InputProps={{ readOnly: true }} size="small" />
            <TextField
              label="Temporary password"
              value={result.admin.temporaryPassword}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => navigator.clipboard?.writeText(result.admin.temporaryPassword)}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} variant="contained">Done</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Create company</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">Company</Typography>
          <TextField label="Company name" value={form.companyName} onChange={set('companyName')} required size="small" />
          <TextField
            label="Slug"
            value={form.companySlug}
            onChange={set('companySlug')}
            helperText="Lowercase letters, numbers, hyphens only"
            required
            size="small"
          />
          <TextField label="Contact email" value={form.contactEmail} onChange={set('contactEmail')} size="small" />
          <TextField label="Contact phone" value={form.contactPhone} onChange={set('contactPhone')} size="small" />

          <Divider />
          <Typography variant="overline" color="text.secondary">First administrator</Typography>
          <TextField label="Full name" value={form.adminName} onChange={set('adminName')} required size="small" />
          <TextField label="Email" value={form.adminEmail} onChange={set('adminEmail')} required size="small" />
          <TextField label="Phone" value={form.adminPhone} onChange={set('adminPhone')} size="small" />
          <TextField
            label="Temporary password"
            value={form.adminPassword}
            onChange={set('adminPassword')}
            type={showPassword ? 'text' : 'password'}
            helperText="At least 6 characters — hand this to the admin directly"
            required
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleCreate} variant="contained" disabled={!canSubmit || saving}>
          {saving ? 'Creating…' : 'Create company'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
