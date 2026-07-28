import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  TextField, Avatar, Box, CircularProgress,
} from '@mui/material';
import { MuiFileInput } from 'mui-file-input';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsSaveBar from '../components/SettingsSaveBar.jsx';
import { fetchMyProfile, updateMyProfile, uploadMyAvatar } from '../profileApi.js';
import { sessionActions } from '../../../store';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';

export default function ProfileSection() {
  useSetTopBarTitle('Settings');
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchMyProfile(user)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setForm(data);
      })
      .catch((e) => setError(e.message || 'Failed to load profile'));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dirty = !!form && !!profile && (
    form.name !== profile.name
    || form.email !== profile.email
    || (form.phone || '') !== (profile.phone || '')
    || (form.jobTitle || '') !== (profile.jobTitle || '')
    || (form.department || '') !== (profile.department || '')
  );

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await updateMyProfile(user, {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        jobTitle: form.jobTitle || null,
        department: form.department || null,
      });
      setProfile(updated);
      setForm(updated);
      dispatch(sessionActions.updateUser({ ...user, name: updated.name, email: updated.email }));
    } catch (e) {
      setError(e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(profile);
    setError('');
  };

  const handleAvatarChange = async (file) => {
    setAvatarFile(file);
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const updated = await uploadMyAvatar(user, file);
      setProfile(updated);
      setForm(updated);
    } catch (e) {
      setError(e.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
      setAvatarFile(null);
    }
  };

  if (!form) {
    return (
      <SettingsCenterShell>
        <SettingsSectionPanel title="Profile" description="Your personal information">
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        </SettingsSectionPanel>
      </SettingsCenterShell>
    );
  }

  return (
    <SettingsCenterShell>
      <SettingsSectionPanel
        title="Profile"
        description="Your personal information, visible to your team."
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar src={form.avatarUrl || undefined} sx={{ width: 64, height: 64, fontSize: '1.5rem' }}>
              {(form.name || '?').slice(0, 2).toUpperCase()}
            </Avatar>
            <MuiFileInput
              placeholder="Change avatar"
              value={avatarFile}
              onChange={handleAvatarChange}
              inputProps={{ accept: 'image/*' }}
              disabled={uploading}
              size="small"
            />
          </Box>
          <TextField
            label="Name"
            value={form.name || ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="Email"
            value={form.email || ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            label="Phone"
            value={form.phone || ''}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <TextField
            label="Job title"
            value={form.jobTitle || ''}
            onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
          />
          <TextField
            label="Department"
            value={form.department || ''}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
        </Box>
        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onCancel={handleCancel}
          error={error}
        />
      </SettingsSectionPanel>
    </SettingsCenterShell>
  );
}
