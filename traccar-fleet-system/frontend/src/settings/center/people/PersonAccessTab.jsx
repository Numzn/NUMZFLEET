import { useEffect, useState } from 'react';
import {
  Alert, Button, Chip, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography,
} from '@mui/material';
import { useEffectAsync } from '../../../reactHelper';
import SettingsSaveBar from '../components/SettingsSaveBar.jsx';
import EditRolesDialog from '../components/EditRolesDialog.jsx';
import { fetchSystemRoles, fetchRoleAssignments } from '../rolesApi.js';
import { updatePerson } from './personApi';

/**
 * Access has two layers here, both editable on this tab. The switches/select
 * below still write Traccar's own administrator/isManager/attributes.numzRole
 * fields directly — kept for compatibility during the transition, not because
 * they're the authority. NUMZFLEET Roles (via EditRolesDialog, reusing the
 * same /api/roles endpoints RolesSection reads) is the actual source of
 * record for this person's NUMZFLEET role assignment going forward.
 *
 * Technician and Dispatcher are one choice rather than two switches because
 * they are stored in a single field and cannot both be set.
 */
export default function PersonAccessTab({
  person, canManage, currentUser, onSaved,
}) {
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

  // NUMZFLEET roles — separate fetch, separate system, from the Traccar-backed
  // fields above. Not scoped to this one person: /api/roles/assignments
  // returns the caller's whole company (same shape EditRolesDialog/RolesSection
  // already consume), matched to this person by Traccar id below.
  const [roles, setRoles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);

  const loadRoleAssignments = async () => {
    setRolesLoading(true);
    try {
      const [systemRoles, roleAssignments] = await Promise.all([
        fetchSystemRoles(currentUser),
        fetchRoleAssignments(currentUser),
      ]);
      setRoles(systemRoles);
      setAssignments(roleAssignments);
    } finally {
      setRolesLoading(false);
    }
  };

  useEffectAsync(async () => {
    await loadRoleAssignments();
    return null;
  }, [person.id]);

  const personRoleAssignments = assignments.filter((a) => a.traccarUserId === person.id);

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
      }, currentUser);
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

      <Stack spacing={1}>
        <Typography variant="subtitle2">NUMZFLEET Roles</Typography>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
          Separate from the Traccar settings above — this is NUMZFLEET&apos;s own record of this person&apos;s role.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
          {rolesLoading && <Typography variant="body2" color="text.secondary">Loading…</Typography>}
          {!rolesLoading && personRoleAssignments.length === 0 && (
            <Typography variant="body2" color="text.secondary">No NUMZFLEET role assigned.</Typography>
          )}
          {personRoleAssignments.map((assignment) => (
            <Chip key={assignment.userRoleId} size="small" label={assignment.roleLabel} />
          ))}
        </Stack>
        {canManage && (
          <Button
            size="small"
            disabled={rolesLoading}
            onClick={() => setRolesDialogOpen(true)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Manage NUMZFLEET roles
          </Button>
        )}
      </Stack>

      <EditRolesDialog
        open={rolesDialogOpen}
        member={person}
        roles={roles}
        assignments={assignments}
        onClose={() => setRolesDialogOpen(false)}
        onChanged={async () => {
          await loadRoleAssignments();
          onSaved();
        }}
      />
    </Stack>
  );
}
