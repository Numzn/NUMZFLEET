import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { traccarPath } from '../config/traccarApi.js';

import {
  Table, TableRow, TableCell, TableHead, TableBody,
} from '@mui/material';
import { useEffectAsync } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import CollectionFab from './components/CollectionFab';
import CollectionActions from './components/CollectionActions';
import TableShimmer from '../common/components/TableShimmer';
import SearchHeader, { filterByKeyword } from './components/SearchHeader';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';

const DriversPage = () => {
  const { classes } = useSettingsStyles();
  const t = useTranslation();

  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);

  const [timestamp, setTimestamp] = useState(Date.now());
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
  }, [timestamp]);

  // Map a driver's uniqueId → the vehicle currently reporting it (Traccar tags
  // the live position with `attributes.driverUniqueId`).
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

  return (
    <>
      <SearchHeader keyword={searchKeyword} setKeyword={setSearchKeyword} />
      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>{t('deviceIdentifier')}</TableCell>
            <TableCell>Phone</TableCell>
            <TableCell>Current vehicle</TableCell>
            <TableCell className={classes.columnAction} />
          </TableRow>
        </TableHead>
        <TableBody>
          {!loading ? items.filter(filterByKeyword(searchKeyword)).map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.uniqueId}</TableCell>
              <TableCell>{item.attributes?.phone || '—'}</TableCell>
              <TableCell>{vehicleByDriverUniqueId[String(item.uniqueId)] || '—'}</TableCell>
              <TableCell className={classes.columnAction} padding="none">
                <CollectionActions itemId={item.id} editPath="/settings/driver" endpoint="drivers" setTimestamp={setTimestamp} />
              </TableCell>
            </TableRow>
          )) : (<TableShimmer columns={5} endAction />)}
        </TableBody>
      </Table>
      <CollectionFab editPath="/settings/driver" />
    </>
  );
};

export default DriversPage;
