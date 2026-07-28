import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Box, Typography, Switch, FormControlLabel, TextField, CircularProgress, Stack, Button,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import { traccarPath } from '../../../config/traccarApi.js';
import { useEffectAsync } from '../../../reactHelper';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { useDeviceReadonly, useManager } from '../../../common/util/permissions';
import { formatStatus, formatTime } from '../../../common/util/formatter';
import usePersistedState from '../../../common/util/usePersistedState';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import exportExcel from '../../../common/util/exportExcel';
import AddressValue from '../../../common/components/AddressValue';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsCard from '../components/SettingsCard.jsx';
import CollectionActions from '../../components/CollectionActions';
import CollectionFab from '../../components/CollectionFab';
import { filterByKeyword } from '../../components/SearchHeader';
import DeviceUsersValue from '../../components/DeviceUsersValue';

/**
 * Restyled DevicesPage.jsx — same data source, same CollectionActions/
 * CollectionFab/export logic, only the list chrome changed. Still gated by
 * TechnicianRoute at the route level (Navigation.jsx), exactly as before.
 */
export default function DevicesSection() {
  useSetTopBarTitle('Settings');
  const theme = useTheme();
  const navigate = useNavigate();
  const t = useTranslation();

  const groups = useSelector((state) => state.groups.items);
  const positions = useSelector((state) => state.session.positions);
  const manager = useManager();
  const deviceReadonly = useDeviceReadonly();

  const [timestamp, setTimestamp] = useState(Date.now());
  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showAll, setShowAll] = usePersistedState('showAllDevices', false);
  const [loading, setLoading] = useState(false);

  useEffectAsync(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ all: showAll });
      const response = await fetchOrThrow(`${traccarPath('/api/devices')}?${query.toString()}`);
      setItems(await response.json());
    } finally {
      setLoading(false);
    }
  }, [timestamp, showAll]);

  const visible = items.filter(filterByKeyword(searchKeyword));

  const handleExport = async () => {
    const data = visible.map((item) => ({
      [t('sharedName')]: item.name,
      [t('deviceIdentifier')]: item.uniqueId,
      [t('groupParent')]: item.groupId ? groups[item.groupId]?.name : null,
      [t('sharedPhone')]: item.phone,
      [t('deviceModel')]: item.model,
      [t('deviceContact')]: item.contact,
      [t('userExpirationTime')]: formatTime(item.expirationTime, 'date'),
      [t('deviceStatus')]: formatStatus(item.status, t),
      [t('deviceLastUpdate')]: formatTime(item.lastUpdate, 'minutes'),
      [t('positionAddress')]: positions[item.id]?.address || '',
    }));
    const sheets = new Map();
    sheets.set(t('deviceTitle'), data);
    await exportExcel(t('deviceTitle'), 'devices.xlsx', sheets, theme);
  };

  const actionConnections = {
    key: 'connections',
    title: t('sharedConnections'),
    icon: <LinkIcon fontSize="small" />,
    handler: (deviceId) => navigate(`/settings/device/${deviceId}/connections`),
  };

  return (
    <SettingsCenterShell>
      <SettingsSectionPanel
        title="Devices"
        description="GPS trackers linked to your fleet."
        actions={(
          <TextField
            size="small"
            placeholder={t('sharedSearch')}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        )}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {visible.map((item) => (
              <SettingsCard key={item.id} sx={{ p: 1.5 }}>
                <Box sx={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2,
                }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={600} noWrap>{item.name}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{item.uniqueId}</Typography>
                    {positions[item.id] && (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" component="div">
                          <AddressValue
                            latitude={positions[item.id].latitude}
                            longitude={positions[item.id].longitude}
                            originalAddress={positions[item.id]?.address}
                          />
                        </Typography>
                      </Box>
                    )}
                    {manager && (
                      <Box sx={{ mt: 0.5 }}>
                        <DeviceUsersValue deviceId={item.id} />
                      </Box>
                    )}
                  </Box>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
                  }}
                  >
                    {item.groupId && (
                      <Typography variant="caption" color="text.secondary">
                        {groups[item.groupId]?.name}
                      </Typography>
                    )}
                    <CollectionActions
                      itemId={item.id}
                      editPath="/settings/device"
                      endpoint="devices"
                      setTimestamp={setTimestamp}
                      customActions={[actionConnections]}
                      readonly={deviceReadonly}
                    />
                  </Box>
                </Box>
              </SettingsCard>
            ))}
            {!visible.length && (
              <Typography variant="body2" color="text.secondary">No devices found.</Typography>
            )}
          </Stack>
        )}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2,
        }}
        >
          <Button onClick={handleExport} variant="text">{t('reportExport')}</Button>
          <FormControlLabel
            control={(
              <Switch
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                size="small"
              />
            )}
            label={t('notificationAlways')}
            disabled={!manager}
          />
        </Box>
      </SettingsSectionPanel>
      <CollectionFab editPath="/settings/device" />
    </SettingsCenterShell>
  );
}
