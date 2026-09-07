import { useEffect, useState } from 'react';
import {
  Alert, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography,
} from '@mui/material';
import SettingsSaveBar from '../components/SettingsSaveBar.jsx';
import { updatePerson } from './personApi';

/**
 * Access is edited here through the fields that actually decide what someone can
 * do. The roles/permissions tables are deliberately not offered: assignments
 * there do not yet change anyone's access, so editing them here would look like
 * granting access without granting it.
 *
 * Technician and Dispatcher are one choice rather than two switches because
 * they are stored in a single field and cannot both be set.
 */
export default function PersonAccessTab({ person, canManage, onSaved }) {
  const readState = (p) => {
    const attributes = p.attributes || {};
    const numzRole = attributes.numzRole || attributes.numz_role || '';
    return {
      administrator: !!p.administrator,
      manager: attributes.isManager === true || attributes.isManager === 'true' || p.isManager === true,
      operationalRole: numzRole === 'technician' || numzRole === 'dispatcher' ? numzRole : '',
      active: !p.disabled,
    };
  };

  const [draft, setDraft] = useState(readState(person));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDraft(readState(person));
    setError(null);
  }, [person]);

  const initial = readState(person);
  const dirty = Object.keys(initial).some((key) => initial[key] !== draft[key]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const attributes = { ...(person.attributes || {}) };

      if (draft.manager) attributes.isManager = true;
      else delete attributes.isManager;

      if (draft.operationalRole) attributes.numzRole = draft.operationalRole;
      else {
        delete attributes.numzRole;
        delete attributes.numz_role;
      }

      await updatePerson({
        ...person,
        administrator: draft.administrator,
        disabled: !draft.active,
        attributes,
      });
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not save these changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      {!canManage && (
        <Alert severity="info">You need manager access to change these settings.</Alert>
      )}

      <Stack spacing={1}>
        <FormControlLabel
          control={(
            <Switch
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              disabled={!canManage || saving}
            />
          )}
          label="Active"
        />
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', mt: -1, ml: 6 }}>
          Turning this off blocks sign-in without deleting anything.
        </Typography>
      </Stack>

      <Stack spacing={1}>
        <FormControlLabel
          control={(
            <Switch
              checked={draft.administrator}
              onChange={(e) => setDraft({ ...draft, administrator: e.target.checked })}
              disabled={!canManage || saving}
            />
          )}
          label="Administrator"
        />
        <FormControlLabel
          control={(
            <Switch
              checked={draft.administrator || draft.manager}
              onChange={(e) => setDraft({ ...draft, manager: e.target.checked })}
              disabled={!canManage || saving || draft.administrator}
            />
          )}
          label="Manager"
        />
        {draft.administrator && (
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', ml: 6 }}>
            Administrators already have manager access.
          </Typography>
        )}
      </Stack>

      <FormControl size="small" sx={{ maxWidth: 320 }} disabled={!canManage || saving}>
        <InputLabel id="person-operational-role">Operational role</InputLabel>
        <Select
          labelId="person-operational-role"
          label="Operational role"
          value={draft.operationalRole}
          onChange={(e) => setDraft({ ...draft, operationalRole: e.target.value })}
        >
          <MenuItem value="">None</MenuItem>
          <MenuItem value="technician">Technician</MenuItem>
          <MenuItem value="dispatcher">Dispatcher</MenuItem>
        </Select>
      </FormControl>

      {canManage && (
        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onCancel={() => { setDraft(readState(person)); setError(null); }}
          error={error}
        />
      )}
    </Stack>
  );
}
