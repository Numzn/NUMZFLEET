import Button from '@mui/material/Button';
import { Snackbar } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from './LocalizationProvider';
import { useCatch } from '../../reactHelper';
import { snackBarDurationLongMs } from '../util/duration';
import fetchOrThrow from '../util/fetchOrThrow';
import { traccarPath } from '../../config/traccarApi.js';

const useStyles = makeStyles()((theme) => ({
  root: {
    [theme.breakpoints.down('md')]: {
      bottom: `calc(${theme.dimensions.bottomBarHeight}px + ${theme.spacing(1)})`,
    },
  },
  button: {
    height: 'auto',
    marginTop: 0,
    marginBottom: 0,
  },
}));

const RemoveDialog = ({
  open, endpoint, itemId, onResult, onRemove,
}) => {
  const { classes } = useStyles();
  const t = useTranslation();

  // onRemove lets a caller (e.g. PeopleSection) route the delete through its own
  // company-scoped fuel-api call instead of this component's default
  // Traccar-direct one — additive; every existing caller keeps the endpoint
  // behavior unchanged by simply not passing it.
  const handleRemove = useCatch(async () => {
    if (onRemove) {
      await onRemove(itemId);
    } else {
      await fetchOrThrow(traccarPath(`/api/${endpoint}/${itemId}`), { method: 'DELETE' });
    }
    onResult(true);
  });

  return (
    <Snackbar
      className={classes.root}
      open={open}
      autoHideDuration={snackBarDurationLongMs}
      onClose={() => onResult(false)}
      message={t('sharedRemoveConfirm')}
      action={(
        <Button size="small" className={classes.button} color="error" onClick={handleRemove}>
          {t('sharedRemove')}
        </Button>
      )}
    />
  );
};

export default RemoveDialog;
