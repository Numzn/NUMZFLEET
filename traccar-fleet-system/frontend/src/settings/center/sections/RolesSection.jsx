import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Stack, Chip, Collapse, ButtonBase, CircularProgress,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsCard from '../components/SettingsCard.jsx';
import { useEffectAsync } from '../../../reactHelper';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import { fetchSystemRoles } from '../rolesApi.js';

// "Can" is just this role's own permissions. "Cannot" is deliberately not
// "every permission this role lacks" (that would turn into the matrix the
// RBAC execution phase explicitly said not to build) — it highlights the
// handful of admin-flavored gaps (organization/platform/system categories)
// that most explain what this role is *not* trusted with, capped short.
const CANNOT_PRIORITY_CATEGORIES = ['organization', 'platform', 'system'];
const CANNOT_LIMIT = 4;

function shortLabel(permission) {
  return (permission.description || permission.key).replace(/\.$/, '');
}

function buildCapabilitySummary(role, allPermissions) {
  const haveKeys = new Set(role.permissions.map((p) => p.key));
  const missing = allPermissions.filter((p) => !haveKeys.has(p.key));
  const prioritized = [
    ...missing.filter((p) => CANNOT_PRIORITY_CATEGORIES.includes(p.category)),
    ...missing.filter((p) => !CANNOT_PRIORITY_CATEGORIES.includes(p.category)),
  ];
  return {
    can: role.permissions,
    cannot: prioritized.slice(0, CANNOT_LIMIT),
  };
}

function RoleCard({ role, allPermissions }) {
  const [showTechnical, setShowTechnical] = useState(false);
  const { can, cannot } = useMemo(() => buildCapabilitySummary(role, allPermissions), [role, allPermissions]);

  return (
    <SettingsCard>
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>{role.label}</Typography>
          {role.key === 'platform_super_admin' && (
            <Chip size="small" label="Platform-level only" variant="outlined" />
          )}
        </Box>

        {can.length > 0 && (
          <Stack spacing={0.5}>
            {can.map((permission) => (
              <Box key={permission.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleOutlineIcon fontSize="small" color="success" />
                <Typography variant="body2">{shortLabel(permission)}</Typography>
              </Box>
            ))}
          </Stack>
        )}

        {cannot.length > 0 && (
          <Stack spacing={0.5}>
            {cannot.map((permission) => (
              <Box key={permission.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CancelOutlinedIcon fontSize="small" color="disabled" />
                <Typography variant="body2" color="text.secondary">{shortLabel(permission)}</Typography>
              </Box>
            ))}
          </Stack>
        )}

        <ButtonBase
          onClick={() => setShowTechnical((v) => !v)}
          sx={{
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5,
          }}
        >
          <Typography variant="caption" color="primary">Show technical permissions</Typography>
          <ExpandMoreIcon
            fontSize="small"
            color="primary"
            sx={{ transform: showTechnical ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </ButtonBase>
        <Collapse in={showTechnical}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {role.permissions.map((permission) => (
              <Chip key={permission.key} size="small" label={permission.key} sx={{ fontFamily: 'monospace' }} />
            ))}
            {role.permissions.length === 0 && (
              <Typography variant="caption" color="text.secondary">No permissions assigned.</Typography>
            )}
          </Box>
        </Collapse>
      </Stack>
    </SettingsCard>
  );
}

/**
 * Read-only explainer for the system roles NUMZFLEET's new roles/permissions
 * foundation understands (see fuel-api/src/permissions/permissionCatalog.js).
 * Deliberately not a role x permission matrix — see the RBAC execution phase
 * instructions this was built against. To change who has a role, use Team.
 */
export default function RolesSection() {
  useSetTopBarTitle('Settings');
  const currentUser = useSelector((state) => state.session.user);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffectAsync(async () => {
    setLoading(true);
    try {
      setRoles(await fetchSystemRoles(currentUser));
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  const allPermissions = useMemo(() => {
    const byKey = new Map();
    roles.forEach((role) => role.permissions.forEach((p) => byKey.set(p.key, p)));
    return [...byKey.values()];
  }, [roles]);

  return (
    <SettingsCenterShell>
      <SettingsSectionPanel
        title="Roles"
        description="What each role can and cannot do. To change who has a role, use Team."
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {roles.map((role) => (
              <RoleCard key={role.key} role={role} allPermissions={allPermissions} />
            ))}
          </Stack>
        )}
      </SettingsSectionPanel>
    </SettingsCenterShell>
  );
}
