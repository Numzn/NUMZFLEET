import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Container,
  Fab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FleetWorkspaceShell from '../../common/components/FleetWorkspaceShell';
import { useManager } from '../../common/util/permissions';
import { traccarPath } from '../../config/traccarApi.js';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { useEffectAsync } from '../../reactHelper';
import SearchHeader, { filterByKeyword } from '../../settings/components/SearchHeader';
import TableShimmer from '../../common/components/TableShimmer';

export default function FleetDriversPage() {
  const navigate = useNavigate();
  const manager = useManager();
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffectAsync(async () => {
    setLoading(true);
    try {
      const response = await fetchOrThrow(traccarPath('/api/drivers'));
      setItems(await response.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const vehicleByDriverUniqueId = useMemo(() => {
    const map = {};
    Object.values(positions || {}).forEach((position) => {
      const driverUniqueId = position?.attributes?.driverUniqueId;
      if (driverUniqueId == null) return;
      const device = devices?.[position.deviceId];
      if (device) map[String(driverUniqueId)] = device.name || device.uniqueId || `#${device.id}`;
    });
    return map;
  }, [devices, positions]);

  if (!manager) {
    return (
      <Container maxWidth="lg" sx={{ py: 2 }}>
        <FleetWorkspaceShell>
          <Typography color="text.secondary">Drivers are available to fleet managers.</Typography>
        </FleetWorkspaceShell>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <FleetWorkspaceShell>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Drivers
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Manage drivers and assign them to vehicles from the vehicle workspace.
        </Typography>
        <SearchHeader keyword={searchKeyword} setKeyword={setSearchKeyword} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Identifier</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Current vehicle</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading ? items.filter(filterByKeyword(searchKeyword)).map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.uniqueId}</TableCell>
                <TableCell>{item.attributes?.phone || '—'}</TableCell>
                <TableCell>{vehicleByDriverUniqueId[String(item.uniqueId)] || '—'}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => navigate(`/fleet/drivers/${item.id}`)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            )) : <TableShimmer columns={5} endAction />}
          </TableBody>
        </Table>
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => navigate('/fleet/drivers/new')}
        >
          <AddIcon />
        </Fab>
      </FleetWorkspaceShell>
    </Container>
  );
}
