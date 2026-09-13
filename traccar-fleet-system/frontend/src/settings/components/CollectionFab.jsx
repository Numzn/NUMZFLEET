import { Fab } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { useRestriction } from '../../common/util/permissions';

const useStyles = makeStyles()((theme) => ({
  fab: {
    position: 'fixed',
    bottom: theme.spacing(2),
    right: theme.spacing(2),
    [theme.breakpoints.down('md')]: {
      bottom: `calc(${theme.dimensions.bottomBarHeight}px + ${theme.spacing(2)})`,
    },
  },
}));

// onClick lets a caller (e.g. PeopleSection) open its own dialog instead of
// navigating to editPath — additive; every existing caller keeps the
// navigate(editPath) behavior unchanged by simply not passing it.
const CollectionFab = ({ editPath, onClick, disabled }) => {
  const { classes } = useStyles();
  const navigate = useNavigate();

  const readonly = useRestriction('readonly');

  if (!readonly && !disabled) {
    return (
      <div className={classes.fab}>
        <Fab size="medium" color="primary" onClick={onClick || (() => navigate(editPath))}>
          <AddIcon />
        </Fab>
      </div>
    );
  }
  return '';
};

export default CollectionFab;
