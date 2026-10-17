import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, InputAdornment, List, ListItemButton,
  ListItemText, TextField, Typography, IconButton,
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
  GEOFENCE_NAME_MAX, boundaryToGeofenceBody, permissionBodies, splitAssignableVehicles,
} from './geofenceHelpers';

const post = (path, body) => fetchOrThrow(traccarPath(path), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const BoundarySearchPanel = ({ onCreated, onDrawInstead }) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [outcome, setOutcome] = useState(null); // { results, pointOnly, invalid }
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState('');
  const [createdId, setCreatedId] = useState(null); // set once the geofence exists, so Create can't run twice

  useEffectAsync(async () => {
    try {
      setVehicles(await fetchVehicles(user));
    } catch {
      setVehicles([]); // assignment is optional; search/save must still work
    }
  }, []);

  const { assignable, unassignable } = useMemo(() => splitAssignableVehicles(vehicles), [vehicles]);

  const runSearch = async (event) => {
    event.preventDefault();
    if (searching || query.trim().length < 3) return;
    setSearching(true);
    setError('');
    setSelected(null);
    setOutcome(null);
    try {
      setOutcome(await searchBoundaries(user, query.trim()));
    } catch (e) {
      setError(e.message || 'Boundary search failed.');
    } finally {
      setSearching(false);
    }
  };

  const choose = (result) => {
    setSelected(result);
    setName(result.name);
    setWarning('');
    setCreatedId(null);
  };

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError('');
    setWarning('');
    let geofence;
    try {
      geofence = await (await post('/api/geofences', boundaryToGeofenceBody(name, selected.geometry))).json();
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

  const { notes } = selected || {};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flexGrow: 1, overflow: 'auto', p: 1.5, gap: 1.5 }}>
      <MapBoundaryPreview geometry={selected?.geometry} />
      <form onSubmit={runSearch}>
        <TextField
          fullWidth
          size="small"
          label="Search place or area"
          placeholder="e.g. Matero, Mandevu, Lusaka"
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
          helperText="Press Enter to search. Boundaries come from OpenStreetMap."
        />
      </form>

      {error && <Alert severity="error">{error}</Alert>}

      {outcome && outcome.results.length === 0 && (
        <Alert severity="info">
          No boundary is available for “{query.trim()}”.
          {outcome.pointOnly > 0
            ? ' OpenStreetMap only has a location pin for it, not an outline, so it can\'t be used as a geofence directly.'
            : ' Try a different spelling.'}
          {' '}You can draw the zone by hand instead.
        </Alert>
      )}

      {outcome && outcome.results.length > 0 && (
        <>
          {outcome.results.length > 1 && (
            <Typography variant="caption" color="text.secondary">
              {outcome.results.length} boundaries match — pick the right one (note the type and parent area).
            </Typography>
          )}
          <List dense disablePadding>
            {outcome.results.map((r) => (
              <ListItemButton key={r.id} selected={selected?.id === r.id} onClick={() => choose(r)} sx={{ borderRadius: 1, alignItems: 'flex-start' }}>
                <ListItemText
                  primary={(
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                      {r.level && <Chip size="small" variant="outlined" label={r.level} />}
                    </Box>
                  )}
                  secondary={`${r.displayName} · ${r.areaKm2.toLocaleString()} km²`}
                />
              </ListItemButton>
            ))}
          </List>
        </>
      )}

      {outcome && outcome.pointResults?.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Found as a location only (no outline available):
          </Typography>
          <List dense disablePadding>
            {outcome.pointResults.map((r) => (
              <ListItemButton key={r.id} onClick={() => onDrawInstead(r.center)} sx={{ borderRadius: 1, alignItems: 'flex-start' }}>
                <ListItemText
                  primary={r.name}
                  secondary={`${r.displayName} — tap to find it on the map and draw the zone`}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}

      {selected && (
        <>
          {(notes.droppedParts > 0 || notes.droppedHoles > 0 || notes.simplified) && (
            <Alert severity="warning">
              Preview shows what will be saved:
              {notes.droppedParts > 0 && ` this place has ${notes.droppedParts + 1} separate areas — only the largest is kept;`}
              {notes.droppedHoles > 0 && ` ${notes.droppedHoles} inner hole(s) are filled in;`}
              {notes.simplified && ` outline simplified to ${selected.vertices} points.`}
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
