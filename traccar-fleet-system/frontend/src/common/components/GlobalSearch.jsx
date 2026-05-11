import { useState, useEffect, useCallback } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SearchIcon from '@mui/icons-material/Search';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DescriptionIcon from '@mui/icons-material/Description';
import CloseIcon from '@mui/icons-material/Close';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getUnifiedSearchFieldStyles } from '../styles/topbarStyles';

const useStyles = makeStyles()((theme) => ({
  searchField: getUnifiedSearchFieldStyles(theme),
}));

const GlobalSearch = () => {
  const { classes } = useStyles();
  const [searchText, setSearchText] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [results, setResults] = useState([]);
  
  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);
  const groups = useSelector((state) => state.groups.items);
  
  const navigate = useNavigate();

  // Keyboard shortcut: Ctrl/Cmd + K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = useCallback((query) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const searchResults = [];
    const lowerQuery = query.toLowerCase();

    // Search devices
    Object.values(devices).forEach((device) => {
      if (device.name?.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          type: 'vehicle',
          icon: <DirectionsCarIcon />,
          title: device.name,
          subtitle: device.uniqueId || 'Vehicle',
          action: () => navigate('/map'),
        });
      }
    });

    // Search drivers
    Object.values(drivers).forEach((driver) => {
      if (driver.name?.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          type: 'driver',
          icon: <PersonIcon />,
          title: driver.name,
          subtitle: driver.uniqueId || 'Driver',
          action: () => navigate('/settings/drivers'),
        });
      }
    });

    // Search groups
    Object.values(groups).forEach((group) => {
      if (group.name?.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          type: 'group',
          icon: <LocationOnIcon />,
          title: group.name,
          subtitle: 'Device Group',
          action: () => navigate('/settings/groups'),
        });
      }
    });

    setResults(searchResults.slice(0, 8)); // Limit to 8 results
  }, [devices, drivers, groups, navigate]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchText(value);
    handleSearch(value);
    if (value && !anchorEl) {
      setAnchorEl(e.currentTarget);
    } else if (!value) {
      setAnchorEl(null);
    }
  };

  const handleResultClick = (result) => {
    result.action();
    setSearchText('');
    setAnchorEl(null);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl) && results.length > 0;

  return (
    <>
      <TextField
        id="global-search-input"
        placeholder="Search vehicles, drivers, locations... (Ctrl+K)"
        value={searchText}
        onChange={handleInputChange}
        variant="outlined"
        size="small"
        className={classes.searchField}
        sx={{
          width: '100%',
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'text.secondary', fontSize: '1.25rem' }} />
            </InputAdornment>
          ),
          endAdornment: searchText && (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={() => {
                  setSearchText('');
                  setAnchorEl(null);
                }}
                sx={{
                  padding: '4px',
                  transition: 'all 0.15s',
                  '&:hover': {
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    transform: 'scale(1.05)',
                  },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            width: anchorEl?.offsetWidth || 400,
            maxHeight: 400,
            mt: 1,
          },
        }}
      >
        <Box sx={{ p: 1.5 }}>
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              px: 2, 
              py: 1, 
              display: 'block',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              fontSize: '0.7rem',
            }}
          >
            Search Results ({results.length})
          </Typography>
          <Divider sx={{ my: 1, opacity: 0.6 }} />
          <List dense>
            {results.map((result, index) => (
              <ListItemButton
                key={index}
                onClick={() => handleResultClick(result)}
                sx={{
                  borderRadius: 1.5,
                  mb: 0.5,
                  transition: 'all 0.15s',
                  '&:hover': {
                    backgroundColor: 'rgba(6, 182, 212, 0.08)',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 42, color: 'primary.main' }}>
                  {result.icon}
                </ListItemIcon>
                <ListItemText
                  primary={result.title}
                  secondary={result.subtitle}
                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Popover>
    </>
  );
};

export default GlobalSearch;







