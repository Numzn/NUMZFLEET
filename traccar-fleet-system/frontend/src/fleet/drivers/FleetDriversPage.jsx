import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Fab,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FleetWorkspaceShell from '../../common/components/FleetWorkspaceShell';
import PageHeader from '../../common/components/PageHeader.jsx';
import PersonStatusChip from '../../common/components/PersonStatusChip';
import { derivePersonStatus } from '../../common/util/personRoles';
import useDriverPersonIndex from '../../common/util/useDriverPersonIndex';
import { useManager } from '../../common/util/permissions';
import { traccarPath } from '../../config/traccarApi.js';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { useEffectAsync } from '../../reactHelper';
import { filterByKeyword } from '../../settings/components/SearchHeader';
import TableShimmer from '../../common/components/TableShimmer';
import { deleteDriver } from '../../settings/center/people/personApi';
import AddDriverDialog from './AddDriverDialog.jsx';

/**
 * The operational view of everyone who drives. People (under Settings) is the
 * full directory; this is the same humans filtered to those with a driver
 * profile, so a row leads to that person's profile rather than to a separate
 * driver record.
 *
 * Tenancy: driver and person data is read globally, not scoped to the caller's
 * company. Pre-existing, and tracked for the later migration behind NUMZFLEET
 * APIs.
 */
export default function FleetDriversPage() {
  const navigate = useNavigate();
  const manager = useManager();
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);

  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [timestamp, setTimestamp] = useState(Date.now());
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [removeError, setRemoveError] = useState(null);

  const { personByDriverId, people } = useDriverPersonIndex();

  useEffectAsync(async () => {
    setLoading(true);
    try {
      const response = await fetchOrThrow(traccarPath('/api/drivers'));
      setItems(await response.json());
    } finally {
      setLoading(false);
    }
    return null;
  }, [timestamp]);

  // A vehicle reports which driver is aboard, which is the only signal for
  // "current vehicle" — there is no stored assignment to read.
  const vehicleByDriverKey = useMemo(() => {
    const map = {};
    Object.values(positions || {}).forEach((position) => {
      const driverKey = position?.attributes?.driverUniqueId;
      if (driverKey == null) return;
      const device = devices?.[position.deviceId];
      if (device) map[String(driverKey)] = device.name || `#${device.id}`;
    });
    return map;
  }, [devices, positions]);

  const openDriver = (driver) => {
    const person = personByDriverId[driver.id];
    navigate(person
      ? `/settings/people/user/${person.id}?tab=driver`
      : `/settings/people/driver/${driver.id}`);
  };

  const handleRemove = async () => {
    try {
      await deleteDriver(removing.id);
      setRemoving(null);
      setRemoveError(null);
      setTimestamp(Date.now());
    } catch (e) {
      setRemoveError(e.message || 'Could not remove this driver profile.');
    }
  };

  if (!manager) {
    return (
      <Container maxWidth="lg" sx={{ py: 2 }}>
        <FleetWorkspaceShell>
          <Alert severity="info">Drivers are available to fleet managers.</Alert>
        </FleetWorkspaceShell>
      </Container>
    );
  }

  const visible = items.filter(filterByKeyword(searchKeyword));

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <FleetWorkspaceShell>
        <PageHeader
          title="Drivers"
          subtitle="Everyone who drives. Open a driver to see the person behind them."
          actions={(
            <TextField
              size="small"
              placeholder="Search"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          )}
        />

        <Table size="small" sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Driver</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Account status</TableCell>
              <TableCell>Current vehicle</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading ? visible.map((item) => {
              const person = personByDriverId[item.id];
              return (
                <TableRow key={item.id} hover>
                  <TableCell
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openDriver(item)}
                  >
                    <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                      {person ? person.name : 'No sign-in account'}
                    </Typography>
                  </TableCell>
                  <TableCell>{item.attributes?.phone || '—'}</TableCell>
                  <TableCell>
                    {person ? <PersonStatusChip status={derivePersonStatus(person)} /> : '—'}
                  </TableCell>
                  <TableCell>{vehicleByDriverKey[String(item.uniqueId)] || '—'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openDriver(item)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove driver profile">
                      <IconButton size="small" onClick={() => { setRemoving(item); setRemoveError(null); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            }) : <TableShimmer columns={5} endAction />}
            {!loading && !visible.length && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                    No drivers found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => setAdding(true)}
        >
          <AddIcon />
        </Fab>

        <AddDriverDialog
          open={adding}
          people={people}
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); setTimestamp(Date.now()); }}
        />

        <Dialog open={!!removing} onClose={() => setRemoving(null)}>
          <DialogTitle>Remove driver profile?</DialogTitle>
          <DialogContent>
            {removeError && <Alert severity="error" sx={{ mb: 2 }}>{removeError}</Alert>}
            <DialogContentText>
              {`This removes ${removing?.name || 'this driver'}'s driver profile and its current vehicle association. Any sign-in account stays untouched.`}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRemoving(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={handleRemove}>Remove</Button>
          </DialogActions>
        </Dialog>
      </FleetWorkspaceShell>
    </Container>
  );
}
