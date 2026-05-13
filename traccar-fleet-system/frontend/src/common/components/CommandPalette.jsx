import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  InputAdornment,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CloseIcon from '@mui/icons-material/Close';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

const MAX_RESULTS = 12;

/**
 * Global command palette (Ctrl/Cmd+K). Same search domains as legacy GlobalSearch.
 */
const CommandPalette = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);
  const groups = useSelector((state) => state.groups.items);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const out = [];

    Object.values(devices).forEach((device) => {
      const name = device.name?.toLowerCase() ?? '';
      const uid = device.uniqueId?.toLowerCase() ?? '';
      if (name.includes(q) || uid.includes(q)) {
        out.push({
          key: `device-${device.id}`,
          icon: <DirectionsCarIcon />,
          title: device.name || device.uniqueId || `Device ${device.id}`,
          subtitle: device.uniqueId || 'Vehicle',
          action: () => navigate('/map'),
        });
      }
    });

    Object.values(drivers).forEach((driver) => {
      if (driver.name?.toLowerCase().includes(q)) {
        out.push({
          key: `driver-${driver.id}`,
          icon: <PersonIcon />,
          title: driver.name,
          subtitle: driver.uniqueId || 'Driver',
          action: () => navigate('/settings/drivers'),
        });
      }
    });

    Object.values(groups).forEach((group) => {
      if (group.name?.toLowerCase().includes(q)) {
        out.push({
          key: `group-${group.id}`,
          icon: <LocationOnIcon />,
          title: group.name,
          subtitle: 'Device group',
          action: () => navigate('/settings/groups'),
        });
      }
    });

    return out.slice(0, MAX_RESULTS);
  }, [devices, drivers, groups, navigate, query]);

  const handlePick = useCallback((item) => {
    item.action();
    setOpen(false);
    setQuery('');
  }, []);

  const handleClose = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: { mt: '12vh' },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 700 }}>
        Search
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 500 }}>
          Ctrl+K
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <TextField
          inputRef={inputRef}
          id="command-palette-search"
          placeholder="Devices, drivers, groups…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          variant="outlined"
          size="small"
          fullWidth
          autoComplete="off"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Clear"
                  onClick={() => setQuery('')}
                  edge="end"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        {results.length > 0 && (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1.5, mb: 0.75, fontWeight: 700, letterSpacing: '0.06em' }}
            >
              Results
            </Typography>
            <Divider sx={{ mb: 1 }} />
            <List dense disablePadding sx={{ maxHeight: 360, overflow: 'auto' }}>
              {results.map((item) => (
                <ListItemButton
                  key={item.key}
                  onClick={() => handlePick(item)}
                  sx={{ borderRadius: 1, mb: 0.25 }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    secondary={item.subtitle}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItemButton>
              ))}
            </List>
          </>
        )}

        {query.trim().length >= 2 && results.length === 0 && (
          <Box sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No matches.
            </Typography>
          </Box>
        )}

        {query.trim().length > 0 && query.trim().length < 2 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Type at least 2 characters.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;
