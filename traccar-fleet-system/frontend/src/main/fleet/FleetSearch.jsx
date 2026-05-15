import { TextField, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useDispatch, useSelector } from 'react-redux';
import { fleetInteractionActions } from '../../store';

const FleetSearch = ({ sx: sxProp = {}, compact = false }) => {
  const dispatch = useDispatch();
  const q = useSelector((s) => s.fleetInteraction.searchQuery);

  const inputMinH = compact ? 36 : 30;

  return (
    <TextField
      size="small"
      fullWidth
      placeholder="Search fleet…"
      value={q}
      onChange={(e) => dispatch(fleetInteractionActions.setFleetSearchQuery(e.target.value))}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start" sx={{ mr: 0.25 }}>
            <SearchIcon sx={{ fontSize: '1rem', color: 'text.secondary', opacity: 0.85 }} />
          </InputAdornment>
        ),
      }}
      sx={{
        flex: 1,
        minWidth: 0,
        '& .MuiInputBase-root': {
          minHeight: inputMinH,
          fontSize: '0.75rem',
          borderRadius: 1,
        },
        '& .MuiInputBase-input': {
          py: compact ? 0.65 : 0.5,
        },
        ...sxProp,
      }}
    />
  );
};

export default FleetSearch;
