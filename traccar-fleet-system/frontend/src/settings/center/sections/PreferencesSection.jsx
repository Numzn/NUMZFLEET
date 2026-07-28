import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ReactCountryFlag from 'react-country-flag';
import {
  Box, FormControl, InputLabel, Select, MenuItem, CircularProgress,
} from '@mui/material';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsSaveBar from '../components/SettingsSaveBar.jsx';
import SelectField from '../../../common/components/SelectField';
import { traccarPath } from '../../../config/traccarApi.js';
import { useTranslation, useTranslationKeys, useLocalization } from '../../../common/components/LocalizationProvider';
import { prefixString, unprefixString } from '../../../common/util/stringUtils';
import useMapStyles from '../../../map/core/useMapStyles';
import { sessionActions } from '../../../store';
import { fetchMyProfile, updateMyProfile } from '../profileApi.js';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';

const DASHBOARD_OPTIONS = [
  { value: '', label: 'Default (Dashboard)' },
  { value: '/map', label: 'Live Map' },
  { value: '/fleet/vehicles', label: 'Fleet Vehicles' },
  { value: '/fleet/operation-sessions/prepare', label: 'Fueling Day' },
];

export default function PreferencesSection() {
  useSetTopBarTitle('Settings');
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);
  const t = useTranslation();
  const { languages } = useLocalization();
  const mapStyles = useMapStyles();

  const languageList = Object.entries(languages).map(([code, value]) => ({
    code, country: value.country, name: value.name,
  }));

  const alarms = useTranslationKeys((it) => it.startsWith('alarm')).map((it) => ({
    key: unprefixString('alarm', it),
    name: t(it),
  }));

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyProfile(user)
      .then((data) => {
        setProfile(data);
        setForm(data);
      })
      .catch((e) => setError(e.message || 'Failed to load preferences'));
  }, [user]);

  const setAttribute = (key, value) => {
    setForm((prev) => ({ ...prev, attributes: { ...prev.attributes, [key]: value } }));
  };

  const dirty = !!form && !!profile && (
    form.map !== profile.map
    || form.coordinateFormat !== profile.coordinateFormat
    || form.defaultDashboard !== profile.defaultDashboard
    || JSON.stringify(form.attributes) !== JSON.stringify(profile.attributes)
  );

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await updateMyProfile(user, {
        map: form.map,
        coordinateFormat: form.coordinateFormat,
        defaultDashboard: form.defaultDashboard || null,
        attributes: form.attributes,
      });
      setProfile(updated);
      setForm(updated);
      dispatch(sessionActions.updateUser({ ...user, attributes: updated.attributes }));
    } catch (e) {
      setError(e.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(profile);
    setError('');
  };

  if (!form) {
    return (
      <SettingsCenterShell>
        <SettingsSectionPanel title="Preferences" description="Map, units, appearance, and language.">
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        </SettingsSectionPanel>
      </SettingsCenterShell>
    );
  }

  const attrs = form.attributes || {};

  return (
    <SettingsCenterShell>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <SettingsSectionPanel title="Map &amp; units" description="Defaults used across the fleet map and reports.">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl>
              <InputLabel>{t('mapDefault')}</InputLabel>
              <Select
                label={t('mapDefault')}
                value={form.map || 'locationIqStreets'}
                onChange={(e) => setForm({ ...form, map: e.target.value })}
              >
                {mapStyles.filter((style) => style.available).map((style) => (
                  <MenuItem key={style.id} value={style.id}>{style.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>{t('settingsCoordinateFormat')}</InputLabel>
              <Select
                label={t('settingsCoordinateFormat')}
                value={form.coordinateFormat || 'dd'}
                onChange={(e) => setForm({ ...form, coordinateFormat: e.target.value })}
              >
                <MenuItem value="dd">{t('sharedDecimalDegrees')}</MenuItem>
                <MenuItem value="ddm">{t('sharedDegreesDecimalMinutes')}</MenuItem>
                <MenuItem value="dms">{t('sharedDegreesMinutesSeconds')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>{t('settingsSpeedUnit')}</InputLabel>
              <Select
                label={t('settingsSpeedUnit')}
                value={attrs.speedUnit || 'kn'}
                onChange={(e) => setAttribute('speedUnit', e.target.value)}
              >
                <MenuItem value="kn">{t('sharedKn')}</MenuItem>
                <MenuItem value="kmh">{t('sharedKmh')}</MenuItem>
                <MenuItem value="mph">{t('sharedMph')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>{t('settingsDistanceUnit')}</InputLabel>
              <Select
                label={t('settingsDistanceUnit')}
                value={attrs.distanceUnit || 'km'}
                onChange={(e) => setAttribute('distanceUnit', e.target.value)}
              >
                <MenuItem value="km">{t('sharedKm')}</MenuItem>
                <MenuItem value="mi">{t('sharedMi')}</MenuItem>
                <MenuItem value="nmi">{t('sharedNmi')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>{t('settingsAltitudeUnit')}</InputLabel>
              <Select
                label={t('settingsAltitudeUnit')}
                value={attrs.altitudeUnit || 'm'}
                onChange={(e) => setAttribute('altitudeUnit', e.target.value)}
              >
                <MenuItem value="m">{t('sharedMeters')}</MenuItem>
                <MenuItem value="ft">{t('sharedFeet')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>{t('settingsVolumeUnit')}</InputLabel>
              <Select
                label={t('settingsVolumeUnit')}
                value={attrs.volumeUnit || 'ltr'}
                onChange={(e) => setAttribute('volumeUnit', e.target.value)}
              >
                <MenuItem value="ltr">{t('sharedLiter')}</MenuItem>
                <MenuItem value="usGal">{t('sharedUsGallon')}</MenuItem>
                <MenuItem value="impGal">{t('sharedImpGallon')}</MenuItem>
              </Select>
            </FormControl>
            <SelectField
              value={attrs.timezone}
              onChange={(e) => setAttribute('timezone', e.target.value)}
              endpoint={traccarPath('/api/server/timezones')}
              keyGetter={(it) => it}
              titleGetter={(it) => it}
              label={t('sharedTimezone')}
            />
          </Box>
        </SettingsSectionPanel>

        <SettingsSectionPanel title="Appearance" description="Theme used across the app.">
          <FormControl fullWidth>
            <InputLabel>{t('sharedTheme')}</InputLabel>
            <Select
              label={t('sharedTheme')}
              value={attrs.darkMode === undefined || attrs.darkMode === null ? 'auto' : (attrs.darkMode ? 'dark' : 'light')}
              onChange={(e) => {
                const { value } = e.target;
                setAttribute('darkMode', value === 'auto' ? null : value === 'dark');
              }}
            >
              <MenuItem value="auto">{t('settingsThemeAuto')}</MenuItem>
              <MenuItem value="light">{t('settingsThemeLight')}</MenuItem>
              <MenuItem value="dark">{t('settingsThemeDark')}</MenuItem>
            </Select>
          </FormControl>
        </SettingsSectionPanel>

        <SettingsSectionPanel title="Sound" description="Which events and alarms play a sound.">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SelectField
              multiple
              value={attrs.soundEvents?.split(',') || []}
              onChange={(e) => setAttribute('soundEvents', e.target.value.join(','))}
              endpoint={traccarPath('/api/notifications/types')}
              keyGetter={(it) => it.type}
              titleGetter={(it) => t(prefixString('event', it.type))}
              label={t('eventsSoundEvents')}
            />
            <SelectField
              multiple
              value={attrs.soundAlarms?.split(',') || ['sos']}
              onChange={(e) => setAttribute('soundAlarms', e.target.value.join(','))}
              data={alarms}
              keyGetter={(it) => it.key}
              label={t('eventsSoundAlarms')}
            />
          </Box>
        </SettingsSectionPanel>

        <SettingsSectionPanel title="Language &amp; landing page" description="Applies the next time you open the app.">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl>
              <InputLabel>Language</InputLabel>
              <Select
                label="Language"
                value={attrs.language || ''}
                onChange={(e) => setAttribute('language', e.target.value || null)}
              >
                <MenuItem value="">Browser default</MenuItem>
                {languageList.map((it) => (
                  <MenuItem key={it.code} value={it.code}>
                    <Box component="span" sx={{ mr: 1, display: 'inline-flex', alignItems: 'center' }}>
                      <ReactCountryFlag countryCode={it.country} svg />
                    </Box>
                    {it.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>Default landing page</InputLabel>
              <Select
                label="Default landing page"
                value={form.defaultDashboard || ''}
                onChange={(e) => setForm({ ...form, defaultDashboard: e.target.value })}
              >
                {DASHBOARD_OPTIONS.map((option) => (
                  <MenuItem key={option.value || 'default'} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </SettingsSectionPanel>

        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onCancel={handleCancel}
          error={error}
        />
      </Box>
    </SettingsCenterShell>
  );
}
