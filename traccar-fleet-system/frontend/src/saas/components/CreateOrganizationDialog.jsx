import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Typography, Alert, Stack, Divider, IconButton, InputAdornment,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const EMPTY_FORM = {
  name: '',
  slug: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
};

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseApiError(e) {
  try {
    return JSON.parse(e.message)?.error || e.message;
  } catch {
    return e.message || 'Failed to create organization';
  }
}

/**
 * Shared create dialog for Partners and Direct Customers — an optional
 * "first administrator" section, provisioning a real login-capable account
 * via createPartner/createDirectCustomer's `admin` field
 * (organizationService.js). Previously these dialogs only ever sent
 * { name, slug } — no admin, so a partner/customer created through the
 * saas/platform UI had no way to log in until someone separately provisioned
 * one through the older Settings -> Platform -> Companies flow (now removed).
 */
export default function CreateOrganizationDialog({
  open, onClose, onCreated, createFn, title, namePlaceholder, slugPlaceholder,
}) {
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
      if (field === 'name' && !slugTouched) {
        next.slug = slugify(value);
      }
      return next;
    });
    if (field === 'slug') setSlugTouched(true);
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setError('');
    setResult(null);
    onClose();
  };

  const adminStarted = form.adminName || form.adminEmail || form.adminPassword;

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const created = await createFn(currentUser, {
        name: form.name,
        slug: form.slug,
        traccarGroupId: null,
        ...(adminStarted ? {
          admin: { name: form.adminName, email: form.adminEmail, password: form.adminPassword },
        } : {}),
      });
      onCreated(created);
      if (created.admin) {
        setResult(created);
      } else {
        handleClose();
      }
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.name && form.slug
    && (!adminStarted || (form.adminName && form.adminEmail && form.adminPassword.length >= 6));

  if (result) {
    return (
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>{result.name} created</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            Hand these credentials to the new admin now — the password will not be shown again.
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
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <TextField label="Name" value={form.name} onChange={set('name')} required size="small" placeholder={namePlaceholder} />
          <TextField
            label="Slug (URL-friendly)"
            value={form.slug}
            onChange={set('slug')}
            helperText="Lowercase letters, numbers, and hyphens only"
            required
            size="small"
            placeholder={slugPlaceholder}
          />

          <Divider />
          <Typography variant="overline" color="text.secondary">First administrator (optional)</Typography>
          <TextField label="Full name" value={form.adminName} onChange={set('adminName')} size="small" />
          <TextField label="Email" value={form.adminEmail} onChange={set('adminEmail')} size="small" />
          <TextField
            label="Temporary password"
            value={form.adminPassword}
            onChange={set('adminPassword')}
            type={showPassword ? 'text' : 'password'}
            helperText="At least 6 characters — hand this to the admin directly"
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
          {saving ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
