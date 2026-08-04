import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  FormGroup, FormControlLabel, Checkbox, Typography, Alert,
} from '@mui/material';
import { assignRole, removeRoleAssignment } from '../rolesApi.js';

/**
 * Assign/remove system-role membership for one team member. Does not edit
 * what a role *means* (its permission bundle) — Company Admins can assign
 * roles, not redefine them. See fuel-api/src/permissions/permissionCatalog.js
 * for the fixed set of system roles this dialog offers.
 */
export default function EditRolesDialog({
  open, member, roles, assignments, onClose, onChanged,
}) {
  const currentUser = useSelector((state) => state.session.user);
  const [pendingKey, setPendingKey] = useState(null);
  const [error, setError] = useState(null);

  if (!member) return null;

  const assignableRoles = roles.filter((r) => r.key !== 'platform_super_admin');
  const memberAssignments = assignments.filter((a) => a.traccarUserId === member.id);

  const handleToggle = async (role, checked) => {
    setError(null);
    setPendingKey(role.key);
    try {
      if (checked) {
        await assignRole(currentUser, member.id, role.key);
      } else {
        const existing = memberAssignments.find((a) => a.roleKey === role.key);
        if (existing) {
          await removeRoleAssignment(currentUser, existing.userRoleId);
        }
      }
      await onChanged();
    } catch (e) {
      setError(e.message || 'Failed to update role');
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        Edit roles
        <Typography variant="body2" color="text.secondary">
          {member.name || member.email}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Roles here are for visibility and planning only — they don&apos;t yet change
          what this person can actually do. Actual access is still controlled by their
          Traccar admin/manager settings.
        </Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <FormGroup>
          {assignableRoles.map((role) => {
            const checked = memberAssignments.some((a) => a.roleKey === role.key);
            return (
              <FormControlLabel
                key={role.key}
                control={(
                  <Checkbox
                    checked={checked}
                    disabled={pendingKey === role.key}
                    onChange={(e) => handleToggle(role, e.target.checked)}
                  />
                )}
                label={role.label}
              />
            );
          })}
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
