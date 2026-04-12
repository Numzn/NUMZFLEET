import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  OutlinedInput,
  InputAdornment,
  IconButton,
  Popover,
  Typography,
  Divider,
  ListItemButton,
  ListItemText,
  Fade,
  Slide,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DeviceItem from './DeviceItem';
import { useTranslation } from '../../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  searchContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchInput: {
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'rgba(6, 182, 212, 0.05)',
      borderRadius: '12px',
      transition: 'all 0.2s',
      '&:hover': {
        backgroundColor: 'rgba(6, 182, 212, 0.08)',
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 8px rgba(6, 182, 212, 0.15)',
      },
      '&.Mui-focused': {
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        boxShadow: '0 6px 16px rgba(6, 182, 212, 0.2)',
        '& fieldset': {
          borderColor: theme.palette.primary.main,
          borderWidth: '2px',
        },
      },
    },
  },
  compactInput: {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
    },
  },
  expandedInput: {
    '& .MuiOutlinedInput-root': {
      borderRadius: '16px',
    },
  },
  searchResults: {
    width: '100%',
    maxWidth: '500px',
    maxHeight: '400px',
    overflow: 'hidden',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    backdropFilter: 'blur(20px)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(6, 182, 212, 0.1)',
  },
  resultsHeader: {
    padding: theme.spacing(1.5, 2),
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    borderBottom: '1px solid rgba(6, 182, 212, 0.1)',
  },
  resultsTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: theme.palette.primary.main,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  resultsCount: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  resultsContent: {
    maxHeight: '320px',
    overflowY: 'auto',
    '&::-webkit-scrollbar': {
      width: '6px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(6, 182, 212, 0.2)',
      borderRadius: '3px',
      '&:hover': {
        backgroundColor: 'rgba(6, 182, 212, 0.3)',
      },
    },
  },
  recentSection: {
    padding: theme.spacing(1, 0),
  },
  recentTitle: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: theme.spacing(0.5, 2),
    marginBottom: theme.spacing(0.5),
  },
  viewAllButton: {
    padding: theme.spacing(1.5, 2),
    textAlign: 'center',
    borderTop: '1px solid rgba(6, 182, 212, 0.1)',
    backgroundColor: 'rgba(6, 182, 212, 0.02)',
    '&:hover': {
      backgroundColor: 'rgba(6, 182, 212, 0.05)',
    },
  },
  viewAllText: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: theme.palette.primary.main,
  },
  noResults: {
    padding: theme.spacing(3, 2),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
  mobileSearchIcon: {
    padding: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: '8px',
    '&:hover': {
      backgroundColor: 'rgba(6, 182, 212, 0.2)',
      transform: 'scale(1.05)',
    },
  },
}));

const SearchWithDropdown = ({
  devices = [],
  onSearch,
  onShowAllDevices,
  compact = false,
  expanded = true,
  placeholder = 'Search devices...',
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Filter devices based on search term
  const filteredDevices = devices.filter(device => {
    if (!searchTerm.trim()) return false;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      device.name?.toLowerCase().includes(searchLower) ||
      device.uniqueId?.toLowerCase().includes(searchLower) ||
      device.phone?.toLowerCase().includes(searchLower)
    );
  });

  // Handle search input changes
  const handleSearchChange = useCallback((event) => {
    const value = event.target.value;
    setSearchTerm(value);
    
    if (onSearch) {
      onSearch(value);
    }
  }, [onSearch]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setAnchorEl(inputRef.current);
  }, []);

  // Handle input blur
  const handleBlur = useCallback(() => {
    // Delay to allow clicking on results
    setTimeout(() => {
      setIsFocused(false);
      setAnchorEl(null);
    }, 200);
  }, []);

  // Handle clear search
  const handleClear = useCallback(() => {
    setSearchTerm('');
    if (onSearch) {
      onSearch('');
    }
    inputRef.current?.focus();
  }, [onSearch]);

  // Handle device selection
  const handleDeviceSelect = useCallback((device) => {
    // Add to recent searches
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.id !== device.id);
      return [device, ...filtered].slice(0, 5);
    });
    
    // Close dropdown
    setIsFocused(false);
    setAnchorEl(null);
    
    // Handle device selection (dispatch to Redux)
    // This would be handled by the parent component
  }, []);

  // Handle show all devices
  const handleShowAll = useCallback(() => {
    if (onShowAllDevices) {
      onShowAllDevices();
    }
    setIsFocused(false);
    setAnchorEl(null);
  }, [onShowAllDevices]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setIsFocused(false);
        setAnchorEl(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mobile: Show only search icon
  if (isMobile && !isFocused) {
    return (
      <IconButton
        className={classes.mobileSearchIcon}
        onClick={() => inputRef.current?.focus()}
        title="Search devices"
      >
        <SearchIcon />
      </IconButton>
    );
  }

  const showResults = isFocused && (searchTerm.length > 0 || recentSearches.length > 0);
  const inputWidth = compact ? '200px' : isFocused ? '400px' : '220px';

  return (
    <Box 
      ref={containerRef}
      className={classes.searchContainer}
      sx={{ width: isMobile ? '100%' : inputWidth }}
    >
      <OutlinedInput
        ref={inputRef}
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleSearchChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`${classes.searchInput} ${compact ? classes.compactInput : ''} ${isFocused ? classes.expandedInput : ''}`}
        startAdornment={
          <InputAdornment position="start">
            <SearchIcon fontSize="small" color="action" />
          </InputAdornment>
        }
        endAdornment={
          <InputAdornment position="end">
            {searchTerm && (
              <IconButton
                size="small"
                onClick={handleClear}
                edge="end"
                sx={{ mr: 0.5 }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            )}
            {!isMobile && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                ⌘K
              </Typography>
            )}
          </InputAdornment>
        }
        size="small"
        fullWidth={isMobile}
      />

      {/* Search Results Dropdown */}
      <Popover
        open={showResults}
        anchorEl={anchorEl}
        onClose={() => setIsFocused(false)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            className: classes.searchResults,
            elevation: 0,
          },
        }}
        disableAutoFocus
        disableEnforceFocus
      >
        <Slide direction="down" in={showResults} timeout={200}>
          <Box>
            {/* Results Header */}
            <Box className={classes.resultsHeader}>
              <Typography className={classes.resultsTitle}>
                <SearchIcon fontSize="small" />
                Search Results
                <Typography component="span" className={classes.resultsCount}>
                  ({filteredDevices.length})
                </Typography>
              </Typography>
            </Box>

            <Box className={classes.resultsContent}>
              {/* Recent Searches */}
              {recentSearches.length > 0 && !searchTerm && (
                <Box className={classes.recentSection}>
                  <Typography className={classes.recentTitle}>
                    Recent Searches
                  </Typography>
                  {recentSearches.slice(0, 3).map((device) => (
                    <DeviceItem
                      key={`recent-${device.id}`}
                      device={device}
                      onClick={() => handleDeviceSelect(device)}
                      compact
                    />
                  ))}
                </Box>
              )}

              {/* Search Results */}
              {searchTerm && (
                <>
                  {filteredDevices.length > 0 ? (
                    filteredDevices.slice(0, 5).map((device) => (
                      <DeviceItem
                        key={device.id}
                        device={device}
                        onClick={() => handleDeviceSelect(device)}
                        compact
                      />
                    ))
                  ) : (
                    <Box className={classes.noResults}>
                      <Typography variant="body2">
                        No devices found for "{searchTerm}"
                      </Typography>
                    </Box>
                  )}
                </>
              )}

              {/* View All Button */}
              {filteredDevices.length > 5 && (
                <Box className={classes.viewAllButton}>
                  <ListItemButton onClick={handleShowAll}>
                    <ListItemText
                      primary={`View all ${filteredDevices.length} results`}
                      primaryTypographyProps={{
                        className: classes.viewAllText,
                      }}
                    />
                    <KeyboardArrowDownIcon fontSize="small" />
                  </ListItemButton>
                </Box>
              )}
            </Box>
          </Box>
        </Slide>
      </Popover>
    </Box>
  );
};

export default SearchWithDropdown;
