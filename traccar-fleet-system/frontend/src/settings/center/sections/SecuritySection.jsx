import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  TextField, Box, Typography, Button, Chip, IconButton, InputAdornment, OutlinedInput,
  InputLabel, FormControl, Table, TableBody, TableCell, TableHead, TableRow, Divider,
} from '@mui/material';
import CachedIcon from '@mui/icons-material/Cached';
import CloseIcon from '@mui/icons-material/Close';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import { changeMyPassword, fetchMyLoginHistory } from '../securityApi.js';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import { formatTime } from '../../../common/util/formatter';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { traccarPath } from '../../../config/traccarApi.js';

function PasswordForm() {
  const user = useSelector((state) => state.session.user);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = currentPassword && newPassword && newPassword === confirmPassword && newPassword.length >= 6;

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await changeMyPassword(user, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (e) {
      setError(e.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Typography color="error" variant="body2">{error}</Typography>}
      {success && <Typography color="success.main" variant="body2">Password changed.</Typography>}
      <TextField
        type="password"
        label="Current password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <TextField
        type="password"
        label="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        helperText="At least 6 characters"
      />
      <TextField
        type="password"
        label="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={mismatch}
        helperText={mismatch ? 'Passwords do not match' : ' '}
      />
      <Box>
        <Button variant="contained" disabled={!canSubmit || saving} onClick={handleSubmit}>
          {saving ? 'Changing…' : 'Change password'}
        </Button>
      </Box>
    </Box>
  );
}

function TotpSection() {
  const totpEnable = useSelector((state) => state.session.server.attributes.totpEnable);
  const currentUser = useSelector((state) => state.session.user);
  const [totpKey, setTotpKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!totpEnable) return;
    fetchOrThrow(traccarPath(`/api/users/${currentUser.id}`))
      .then((r) => r.json())
      .then((u) => setTotpKey(u.totpKey || null))
      .catch(() => {});
  }, [totpEnable, currentUser.id]);

  if (!totpEnable) return null;

  const persistTotpKey = async (nextKey) => {
    setBusy(true);
    setError('');
    try {
      const current = await fetchOrThrow(traccarPath(`/api/users/${currentUser.id}`)).then((r) => r.json());
      await fetchOrThrow(traccarPath(`/api/users/${currentUser.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...current, totpKey: nextKey }),
      });
      setTotpKey(nextKey);
    } catch (e) {
      setError(e.message || 'Failed to update two-factor authentication');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetchOrThrow(traccarPath('/api/users/totp'), { method: 'POST' });
      const nextKey = await response.text();
      setBusy(false);
      await persistTotpKey(nextKey);
    } catch (e) {
      setBusy(false);
      setError(e.message || 'Failed to generate a new TOTP key');
    }
  };

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Two-factor authentication</Typography>
      {error && <Typography color="error" variant="body2" sx={{ mb: 1 }}>{error}</Typography>}
      <FormControl fullWidth>
        <InputLabel>TOTP key</InputLabel>
        <OutlinedInput
          readOnly
          label="TOTP key"
          value={totpKey || ''}
          disabled={busy}
          endAdornment={(
            <InputAdornment position="end">
              <IconButton size="small" edge="end" onClick={handleGenerate} disabled={busy} aria-label="Generate TOTP key">
                <CachedIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" edge="end" onClick={() => persistTotpKey(null)} disabled={busy || !totpKey} aria-label="Clear TOTP key">
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          )}
        />
      </FormControl>
    </>
  );
}

function LoginHistory() {
  const user = useSelector((state) => state.session.user);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchMyLoginHistory(user).then((data) => setItems(data.items || [])).finally(() => setLoading(false));
  }, [user]);

  const handleLoadMore = async () => {
    if (!items.length) return;
    setLoadingMore(true);
    try {
      const before = items[items.length - 1].occurredAt;
      const data = await fetchMyLoginHistory(user, { before });
      setItems((prev) => [...prev, ...(data.items || [])]);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <Typography variant="body2" color="text.secondary">Loading…</Typography>;
  if (!items.length) return <Typography variant="body2" color="text.secondary">No login activity recorded yet.</Typography>;

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>When</TableCell>
            <TableCell>Result</TableCell>
            <TableCell>IP address</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{formatTime(item.occurredAt, 'minutes')}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={item.outcome}
                  color={item.outcome === 'success' ? 'success' : 'default'}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>{item.ip || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {items.length >= 20 && (
        <Box sx={{ mt: 1 }}>
          <Button size="small" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default function SecuritySection() {
  useSetTopBarTitle('Settings');

  return (
    <SettingsCenterShell>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <SettingsSectionPanel title="Password" description="Change your account password.">
          <PasswordForm />
          <TotpSection />
        </SettingsSectionPanel>
        <SettingsSectionPanel title="Login history" description="Recent sign-in attempts on your account.">
          <LoginHistory />
        </SettingsSectionPanel>
      </Box>
    </SettingsCenterShell>
  );
}
