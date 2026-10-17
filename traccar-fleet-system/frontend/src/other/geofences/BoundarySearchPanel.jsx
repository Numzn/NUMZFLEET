import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, InputAdornment, List, ListItemButton,
  ListItemText, TextField, ToggleButton, ToggleButtonGroup, Typography, IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { traccarPath } from '../../config/traccarApi.js';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { useEffectAsync } from '../../reactHelper';
import { fetchVehicles } from '../../fleet/vehiclesApi';
import { geofencesActions } from '../../store';
import MapBoundaryPreview from '../../map/draw/MapBoundaryPreview';
import { searchBoundaries } from './boundarySearchApi';
import {
  GEOFENCE_NAME_MAX, RADIUS_MAX_M, RADIUS_MIN_M, RADIUS_PRESETS_M, boundaryToGeofenceBody, defaultRadiusName,
  formatRadius, permissionBodies, radiusPreviewGeometry, radiusZoneBody, splitAssignableVehicles,
} from './geofenceHelpers';

const post = (path, body) => fetchOrThrow(traccarPath(path), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const KIND_COLOR = { town: 'success', district: 'warning', province: 'warning' };

const BoundaryRow = ({ place, selected, onClick }) => (
  <ListItemButton selected={selected} onClick={onClick} sx={{ borderRadius: 1, alignItems: 'flex-start' }}>
    <ListItemText
      disableTypography
      primary={(
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" fontWeight={600}>{place.name}</Typography>
          <Chip size="small" color={KIND_COLOR[place.kind] || 'default'} variant="outlined" label={`${place.levelLabel} boundary`} />
          {place.recommended && <Chip size="small" color="primary" label="Recommended" />}
        </Box>
      )}
      secondary={(
        <>
          <Typography variant="caption" color="text.secondary" display="block">
            {[place.province ? `${place.province} Province` : null, place.areaKm2 != null ? `${place.areaKm2.toLocaleString()} km²` : null, place.sourceLabel].filter(Boolean).join(' · ')}
          </Typography>
          {place.warning && (
            <Typography variant="caption" color="warning.main" display="block">{place.warning}</Typography>
          )}
        </>
      )}
    />
  </ListItemButton>
);

const BoundarySearchPanel = ({ onCreated, onDrawInstead }) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState('');
  // selected: { kind: 'boundary', place } | { kind: 'radius', place }
  const [selected, setSelected] = useState(null);
  const [radiusM, setRadiusM] = useState(2000);
  const [customKm, setCustomKm] = useState('');
  const [name, setName] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState('');
  const [createdId, setCreatedId] = useState(null);

  useEffectAsync(async () => {
    try {
      setVehicles(await fetchVehicles(user));
    } catch {
      setVehicles([]); // assignment is optional; search/save must still work
    }
  }, []);

  const { assignable, unassignable } = useMemo(() => splitAssignableVehicles(vehicles), [vehicles]);

  // The preview IS the geometry that will be saved (boundary), or the circle Traccar will test (radius).
  const previewGeometry = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === 'boundary') return selected.place.geometry;
    return radiusPreviewGeometry(selected.place.center, radiusM);
  }, [selected, radiusM]);

  const reset = () => {
    setSelected(null);
    setWarning('');
    setCreatedId(null);
  };

  const runSearch = async (event) => {
    event.preventDefault();
    if (searching || query.trim().length < 3) return;
    setSearching(true);
    setError('');
    reset();
    setOutcome(null);
    try {
      setOutcome(await searchBoundaries(user, query.trim()));
    } catch (e) {
      setError(e.message || 'Boundary search failed.');
    } finally {
      setSearching(false);
    }
  };

  const chooseBoundary = (place) => {
    reset();
    setSelected({ kind: 'boundary', place });
    setName(place.name);
  };

  const chooseRadius = (place) => {
    reset();
    setSelected({ kind: 'radius', place });
    setName(defaultRadiusName(place.name, radiusM));
  };

  const changeRadius = (m) => {
    setRadiusM(m);
    if (selected?.kind === 'radius') setName(defaultRadiusName(selected.place.name, m));
  };

  const customRadiusError = customKm !== '' && !(Number(customKm) * 1000 >= RADIUS_MIN_M && Number(customKm) * 1000 <= RADIUS_MAX_M);

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError('');
    setWarning('');
    let geofence;
    try {
      const body = selected.kind === 'boundary'
        ? boundaryToGeofenceBody(name, selected.place.geometry, selected.place)
        : radiusZoneBody(name, selected.place.center, radiusM, selected.place.name);
      geofence = await (await post('/api/geofences', body)).json();
    } catch (e) {
      setError(e.message);
      setSaving(false);
      return;
    }
    dispatch(geofencesActions.update([geofence]));
    const results = await Promise.allSettled(
      permissionBodies(geofence.id, chosen).map((body) => post('/api/permissions', body)),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    setSaving(false);
    if (failed) {
      setCreatedId(geofence.id);
      setWarning(`Geofence created, but ${failed} of ${results.length} vehicle assignments failed. Assign them from the vehicle's Zone Monitoring settings.`);
      return;
    }
    setSelected(null);
    setOutcome(null);
    setChosen([]);
    onCreated(geofence.id);
  };

  const notes = selected?.kind === 'boundary' ? selected.place.notes || {} : {};
  const boundaries = outcome?.boundaries || [];
  const locations = outcome?.locations || [];
  const nothingFound = outcome && !boundaries.length && !locations.length;
  const noTown = outcome && !outcome.townBoundary;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flexGrow: 1, overflow: 'auto', p: 1.5, gap: 1.5 }}>
      <MapBoundaryPreview geometry={previewGeometry} />
      <form onSubmit={runSearch}>
        <TextField
          fullWidth
          size="small"
          label="Search a town, district or province"
          placeholder="e.g. Chipata, Lusaka, Kabwe, Livingstone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton type="submit" size="small" disabled={searching || query.trim().length < 3} aria-label="Search">
                    {searching ? <CircularProgress size={18} /> : <SearchIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
          helperText="Press Enter to search. Boundaries come from geoBoundaries and OpenStreetMap."
        />
      </form>

      {error && <Alert severity="error">{error}</Alert>}

      {outcome?.notice && <Alert severity={nothingFound ? 'info' : 'warning'}>{outcome.notice}</Alert>}

      {boundaries.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Verified boundaries — pick the one you mean:
          </Typography>
          <List dense disablePadding>
            {boundaries.map((place) => (
              <BoundaryRow
                key={place.id}
                place={place}
                selected={selected?.kind === 'boundary' && selected.place.id === place.id}
                onClick={() => chooseBoundary(place)}
              />
            ))}
          </List>
        </Box>
      )}

      {locations.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            {noTown ? 'No verified town boundary — only a location:' : 'Locations without a boundary:'}
          </Typography>
          <List dense disablePadding>
            {locations.map((place) => (
              <ListItemButton
                key={place.id}
                selected={selected?.kind === 'radius' && selected.place.id === place.id}
                onClick={() => chooseRadius(place)}
                sx={{ borderRadius: 1, alignItems: 'flex-start' }}
              >
                <ListItemText
                  disableTypography
                  primary={(
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="body2" fontWeight={600}>{place.name}</Typography>
                      <Chip size="small" variant="outlined" label={`${place.levelLabel} · location only`} />
                    </Box>
                  )}
                  secondary={<Typography variant="caption" color="text.secondary">Tap to create a radius zone around this location</Typography>}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}

      {outcome && (noTown || nothingFound) && (
        <Button
          size="small"
          variant="outlined"
          onClick={() => onDrawInstead(locations[0]?.center || boundaries[0]?.center || null)}
        >
          Draw a custom geofence on the map instead
        </Button>
      )}

      {outcome?.attribution?.length > 0 && (
        <Typography variant="caption" color="text.secondary" display="block">
          Data: {outcome.attribution.join(' · ')}
        </Typography>
      )}

      {selected?.kind === 'radius' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Alert severity="info">
            Radius zone around the {selected.place.name} location. This is an operational circle, not the
            town&apos;s boundary.
          </Alert>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={RADIUS_PRESETS_M.includes(radiusM) && customKm === '' ? radiusM : null}
            onChange={(_, v) => { if (v) { setCustomKm(''); changeRadius(v); } }}
            sx={{ flexWrap: 'wrap' }}
          >
            {RADIUS_PRESETS_M.map((m) => <ToggleButton key={m} value={m}>{formatRadius(m)}</ToggleButton>)}
          </ToggleButtonGroup>
          <TextField
            size="small"
            type="number"
            label="Custom radius (km)"
            value={customKm}
            error={customRadiusError}
            helperText={customRadiusError ? `Between ${RADIUS_MIN_M / 1000} and ${RADIUS_MAX_M / 1000} km` : ' '}
            onChange={(e) => {
              setCustomKm(e.target.value);
              const m = Number(e.target.value) * 1000;
              if (m >= RADIUS_MIN_M && m <= RADIUS_MAX_M) changeRadius(Math.round(m));
            }}
            slotProps={{ htmlInput: { min: RADIUS_MIN_M / 1000, max: RADIUS_MAX_M / 1000, step: 0.1 } }}
          />
        </Box>
      )}

      {selected && (
        <>
          {selected.kind === 'boundary' && (notes.droppedParts > 0 || notes.droppedHoles > 0 || notes.simplified) && (
            <Alert severity="warning">
              Preview shows exactly what will be saved:
              {notes.droppedParts > 0 && ` this place has ${notes.droppedParts + 1} separate areas — only the largest is kept (${notes.droppedAreaPct}% of the area is left out);`}
              {notes.droppedHoles > 0 && ` ${notes.droppedHoles} inner hole(s) are filled in;`}
              {notes.simplified && ` outline simplified to ${selected.place.vertices} points (within about ${selected.place.maxDeviationM ?? 0} m of the source).`}
            </Alert>
          )}
          <TextField
            size="small"
            label="Geofence name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: GEOFENCE_NAME_MAX } }}
            required
          />
          <Autocomplete
            multiple
            size="small"
            options={assignable}
            value={chosen}
            onChange={(_, v) => setChosen(v)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            getOptionLabel={(v) => v.name || v.plateNumber || `Vehicle ${v.id}`}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Assign vehicles (optional)"
                helperText={unassignable > 0 ? `${unassignable} vehicle(s) have no tracker linked and can't be assigned.` : 'Assigned vehicles raise enter/exit events for this zone.'}
              />
            )}
          />
          {warning && <Alert severity="warning">{warning}</Alert>}
          <Box sx={{
            position: 'sticky', bottom: 0, pt: 1, pb: 1, bgcolor: 'var(--surface-card)',
          }}
          >
            {createdId ? (
              <Button fullWidth variant="contained" onClick={() => onCreated(createdId)}>Open geofence</Button>
            ) : (
              <Button fullWidth variant="contained" onClick={save} disabled={saving || !name.trim()}>
                {saving ? 'Creating…' : 'Create geofence'}
              </Button>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

export default BoundarySearchPanel;
