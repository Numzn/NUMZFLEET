import { useState } from 'react';
import { traccarPath } from '../config/traccarApi.js';

import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import {
  Box, Chip, InputAdornment, List, ListItemButton, ListItemText, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

import { geofencesActions } from '../store';
import CollectionActions from '../settings/components/CollectionActions';
import { useCatchCallback } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { filterGeofences, geofenceKind } from './geofences/geofenceHelpers';

const useStyles = makeStyles()(() => ({
  list: {
    flexGrow: 1,
    overflow: 'auto',
    padding: 'var(--space-2)',
  },
  item: {
    borderRadius: 'var(--radius-md)',
    marginBottom: 2,
    minHeight: 44,
    '&:hover': {
      backgroundColor: 'var(--surface-card-hover)',
    },
  },
  itemText: {
    '& .MuiListItemText-primary': {
      fontSize: '0.875rem',
      fontWeight: 500,
    },
  },
}));

const GeofencesList = ({ onGeofenceSelected, selectedGeofenceId }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');

  const items = useSelector((state) => state.geofences.items);
  const visible = filterGeofences(items, query);

  const refreshGeofences = useCatchCallback(async () => {
    const response = await fetchOrThrow(traccarPath('/api/geofences'));
    dispatch(geofencesActions.refresh(await response.json()));
  }, [dispatch]);

  return (
    <>
      <Box sx={{ p: 1.5, pb: 0.5 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search geofences"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              ),
            },
          }}
        />
      </Box>
      <List className={classes.list} disablePadding>
        {visible.map((item) => (
          <ListItemButton
            key={item.id}
            className={classes.item}
            selected={item.id === selectedGeofenceId}
            onClick={() => onGeofenceSelected(item.id)}
          >
            <ListItemText primary={item.name} className={classes.itemText} />
            <Chip size="small" variant="outlined" label={geofenceKind(item.area)} sx={{ mr: 1 }} />
            <CollectionActions itemId={item.id} editPath="/settings/geofence" endpoint="geofences" setTimestamp={refreshGeofences} />
          </ListItemButton>
        ))}
        {visible.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {Object.keys(items).length === 0
              ? 'No geofences yet. Use the Create tab to draw one or search for a place.'
              : 'No geofences match your search.'}
          </Typography>
        )}
      </List>
    </>
  );
};

export default GeofencesList;
