import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import ReportFilter from './components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import ReportsMenu from './components/ReportsMenu';
import { useCatch } from '../reactHelper';
import MapView from '../map/core/MapView';
import useReportStyles from './common/useReportStyles';
import TableShimmer from '../common/components/TableShimmer';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import { formatTime } from '../common/util/formatter';
import { prefixString } from '../common/util/stringUtils';
import MapMarkers from '../map/MapMarkers';
import MapRouteCoordinates from '../map/MapRouteCoordinates';
import MapScale from '../map/MapScale';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { traccarPath } from '../config/traccarApi.js';
import useReportDeviceLabel from './common/useReportDeviceLabel';

const CombinedReportPage = () => {
  const { classes } = useReportStyles();
  const t = useTranslation();

  const devices = useSelector((state) => state.devices.items);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { primaryForDevice } = useReportDeviceLabel();

  const itemsCoordinates = useMemo(() => items.flatMap((item) => item.route), [items]);

  const createMarkers = () => items.flatMap((item) => item.events
    .map((event) => item.positions.find((p) => event.positionId === p.id))
    .filter((position) => position != null)
    .map((position) => ({
      latitude: position.latitude,
      longitude: position.longitude,
    })));

  const onShow = useCatch(async ({ deviceIds, groupIds, from, to }) => {
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    groupIds.forEach((groupId) => query.append('groupId', groupId));
    setLoading(true);
    try {
      const response = await fetchOrThrow(`${traccarPath('/api/reports/combined')}?${query.toString()}`);
      setItems(await response.json());
    } finally {
      setLoading(false);
    }
  });

  return (
      <div className={classes.container}>
        {Boolean(items.length) && (
          <div className={classes.containerMap}>
            <MapView>
              <MapGeofence />
              {items.map((item) => (
                <MapRouteCoordinates
                  key={item.deviceId}
                  name={primaryForDevice(item.deviceId)}
                  coordinates={item.route}
                  deviceId={item.deviceId}
                />
              ))}
              <MapMarkers markers={createMarkers()} />
            </MapView>
            <MapScale />
            <MapCamera coordinates={itemsCoordinates} />
          </div>
        )}
        <div className={classes.containerMain}>
          <div className={classes.header}>
            <ReportFilter onShow={onShow} deviceType="multiple" loading={loading} />
          </div>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedDevice')}</TableCell>
                <TableCell>{t('positionFixTime')}</TableCell>
                <TableCell>{t('sharedType')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading ? items.flatMap((item) => item.events.map((event, index) => (
                <TableRow key={event.id}>
                  <TableCell>{index ? '' : primaryForDevice(item.deviceId)}</TableCell>
                  <TableCell>{formatTime(event.eventTime, 'seconds')}</TableCell>
                  <TableCell>{t(prefixString('event', event.type))}</TableCell>
                </TableRow>
              ))) : (<TableShimmer columns={3} />)}
            </TableBody>
          </Table>
        </div>
      </div>
  );
};

export default CombinedReportPage;
