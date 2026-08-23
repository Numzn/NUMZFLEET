import { traccarPath } from '../config/traccarApi.js';

import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import { List, ListItemButton, ListItemText } from '@mui/material';

import { geofencesActions } from '../store';
import CollectionActions from '../settings/components/CollectionActions';
import { useCatchCallback } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';

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

const GeofencesList = ({ onGeofenceSelected }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();

  const items = useSelector((state) => state.geofences.items);

  const refreshGeofences = useCatchCallback(async () => {
    const response = await fetchOrThrow(traccarPath('/api/geofences'));
    dispatch(geofencesActions.refresh(await response.json()));
  }, [dispatch]);

  return (
    <List className={classes.list} disablePadding>
      {Object.values(items).map((item) => (
        <ListItemButton key={item.id} className={classes.item} onClick={() => onGeofenceSelected(item.id)}>
          <ListItemText primary={item.name} className={classes.itemText} />
          <CollectionActions itemId={item.id} editPath="/settings/geofence" endpoint="geofences" setTimestamp={refreshGeofences} />
        </ListItemButton>
      ))}
    </List>
  );
};

export default GeofencesList;
