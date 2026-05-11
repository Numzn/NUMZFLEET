import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

const CommandPalette = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const devices = useSelector((state) => state.devices.items || {});
  const drivers = useSelector((state) => state.drivers.items || {});
  const groups = useSelector((state) => state.groups.items || {});

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const out = [];

    Object.values(devices).forEach((device) => {
      if (device?.name?.toLowerCase?.().includes(q)) {
        out.push({
          key: `vehicle:${device.id}`,
          icon: <DirectionsCarIcon />,
          title: device.name,
          subtitle: device.uniqueId || 'Vehicle',
          action: () => navigate('/map'),
        });
      }
    });

    Object.values(drivers).forEach((driver) => {
      if (driver?.name?.toLowerCase?.().includes(q)) {
        out.push({
          key: `driver:${driver.id}`,
          icon: <PersonIcon />,
          title: driver.name,
          subtitle: driver.uniqueId || 'Driver',
          action: () => navigate('/settings/drivers'),
        });
      }
    });

    Object.values(groups).forEach((group) => {
      if (group?.name?.toLowerCase?.().includes(q)) {
        out.push({
          key: `group:${group.id}`,
          icon: <LocationOnIcon />,
          title: group.name,
          subtitle: 'Device Group',
          action: () => navigate('/settings/groups'),
        });
      }
    });

    return out.slice(0, 10);
  }, [devices, drivers, groups, navigate, query]);

  const handlePick = (item) => {
    item.action?.();
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          mt: { xs: 2, sm: 6 },
          borderRadius: 2,
        },
      }}
    >
      <DialogContent sx={{ p: 1.5 }}>
        <TextField
          autoFocus
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search vehicles, drivers, groups…"
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={close} sx={{ p: 0.5 }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Divider sx={{ my: 1 }} />

        <Box sx={{ maxHeight: 420, overflow: 'auto' }}>
          {results.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1.5, px: 0.5 }}>
              Type at least 2 characters. Press Esc to close.
            </Typography>
          ) : (
            <List dense disablePadding>
              {results.map((r) => (
                <ListItemButton
                  key={r.key}
                  onClick={() => handlePick(r)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.25,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>
                    {r.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={r.title}
                    secondary={r.subtitle}
                    primaryTypographyProps={{ fontWeight: 700, fontSize: '0.9rem' }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;

