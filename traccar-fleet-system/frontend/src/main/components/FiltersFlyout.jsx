import React, { useState, useCallback } from 'react';
import {
  Box,
  Drawer,
  IconButton,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  FormGroup,
  FormControlLabel,
  Switch,
  Button,
  Chip,
  Stack,
  useTheme,
  useMediaQuery,
  Slide,
  Fade,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';
import ClearIcon from '@mui/icons-material/Clear';
import { useTranslation } from '../../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  filterButton: {
    padding: '8px',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: '8px',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: 'rgba(6, 182, 212, 0.15)',
      transform: 'scale(1.05)',
    },
  },
  drawer: {
    '& .MuiDrawer-paper': {
      width: 360,
      top: 56,
      height: 'calc(100vh - 56px)',
      borderRadius: '0 16px 16px 0',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      borderLeft: '1px solid rgba(6, 182, 212, 0.1)',
    },
  },
  mobileDrawer: {
    '& .MuiDrawer-paper': {
      width: '100%',
      top: 56,
      height: 'calc(100vh - 56px)',
      borderRadius: '16px 16px 0 0',
    },
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: theme.spacing(3),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: theme.palette.primary.main,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  activeFilters: {
    marginBottom: theme.spacing(2),
  },
  activeFiltersTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  activeChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
  activeChip: {
    fontSize: '0.75rem',
    height: '28px',
    '& .MuiChip-deleteIcon': {
      fontSize: '16px',
    },
  },
  section: {
    marginBottom: theme.spacing(3),
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(1.5),
  },
  formControl: {
    marginBottom: theme.spacing(2),
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
    },
  },
  select: {
    '& .MuiSelect-select': {
      padding: theme.spacing(1.5),
    },
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  checkboxItem: {
    padding: theme.spacing(0.5, 0),
    '& .MuiFormControlLabel-label': {
      fontSize: '0.875rem',
    },
  },
  switchGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  footer: {
    marginTop: 'auto',
    paddingTop: theme.spacing(2),
    borderTop: '1px solid rgba(6, 182, 212, 0.1)',
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'flex-end',
  },
  clearButton: {
    color: theme.palette.text.secondary,
    '&:hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      color: theme.palette.error.main,
    },
  },
  applyButton: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  compactButton: {
    padding: '6px',
    minWidth: 'auto',
  },
}));

const FiltersFlyout = ({
  onFilterChange,
  compact = false,
  filters = {},
  groups = [],
  devices = [],
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    statuses: filters.statuses || [],
    groups: filters.groups || [],
    sortBy: filters.sortBy || '',
    mapOnly: filters.mapOnly || false,
    cluster: filters.cluster || false,
  });

  // Calculate device counts by status
  const deviceStatusCount = (status) => 
    Object.values(devices).filter((d) => d.status === status).length;

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleFilterChange = useCallback((filterType, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [filterType]: value,
    }));
  }, []);

  const handleApplyFilters = useCallback(() => {
    if (onFilterChange) {
      onFilterChange(localFilters);
    }
    handleClose();
  }, [onFilterChange, localFilters, handleClose]);

  const handleClearFilters = useCallback(() => {
    const clearedFilters = {
      statuses: [],
      groups: [],
      sortBy: '',
      mapOnly: false,
      cluster: false,
    };
    setLocalFilters(clearedFilters);
    if (onFilterChange) {
      onFilterChange(clearedFilters);
    }
  }, [onFilterChange]);

  const handleRemoveFilter = useCallback((filterType, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [filterType]: prev[filterType].filter(item => item !== value),
    }));
  }, []);

  // Get active filters for display
  const activeFilters = [
    ...localFilters.statuses.map(status => ({ type: 'status', value: status, label: status })),
    ...localFilters.groups.map(groupId => {
      const group = groups.find(g => g.id === groupId);
      return { type: 'group', value: groupId, label: group?.name || 'Unknown Group' };
    }),
    ...(localFilters.sortBy ? [{ type: 'sort', value: localFilters.sortBy, label: `Sort: ${localFilters.sortBy}` }] : []),
    ...(localFilters.mapOnly ? [{ type: 'map', value: 'mapOnly', label: 'Map Only' }] : []),
    ...(localFilters.cluster ? [{ type: 'cluster', value: 'cluster', label: 'Clustered' }] : []),
  ];

  const FilterButton = () => (
    <IconButton
      onClick={handleOpen}
      className={`${classes.filterButton} ${compact ? classes.compactButton : ''}`}
      title="Filters & Sort"
    >
      <TuneIcon fontSize="small" />
    </IconButton>
  );

  return (
    <>
      <FilterButton />
      
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        variant="temporary"
        className={`${classes.drawer} ${isMobile ? classes.mobileDrawer : ''}`}
        SlideProps={{
          direction: 'left',
          timeout: 300,
        }}
      >
        <Box className={classes.panel}>
          {/* Header */}
          <Box className={classes.header}>
            <Box>
              <Typography className={classes.title}>
                Filters & Sort
              </Typography>
              <Typography className={classes.subtitle}>
                Refine your device list
              </Typography>
            </Box>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <Box className={classes.activeFilters}>
              <Typography className={classes.activeFiltersTitle}>
                Active Filters
              </Typography>
              <Box className={classes.activeChips}>
                {activeFilters.map((filter, index) => (
                  <Chip
                    key={`${filter.type}-${filter.value}`}
                    label={filter.label}
                    size="small"
                    className={classes.activeChip}
                    onDelete={() => handleRemoveFilter(filter.type, filter.value)}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ marginBottom: theme.spacing(2) }} />

          {/* Status Filter */}
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>
              Status
            </Typography>
            <FormControl fullWidth className={classes.formControl}>
              <InputLabel>Device Status</InputLabel>
              <Select
                multiple
                value={localFilters.statuses}
                onChange={(e) => handleFilterChange('statuses', e.target.value)}
                renderValue={(selected) => `${selected.length} selected`}
                className={classes.select}
              >
                <MenuItem value="online">
                  <Checkbox checked={localFilters.statuses.indexOf('online') > -1} />
                  <ListItemText 
                    primary={`Online (${deviceStatusCount('online')})`} 
                  />
                </MenuItem>
                <MenuItem value="offline">
                  <Checkbox checked={localFilters.statuses.indexOf('offline') > -1} />
                  <ListItemText 
                    primary={`Offline (${deviceStatusCount('offline')})`} 
                  />
                </MenuItem>
                <MenuItem value="unknown">
                  <Checkbox checked={localFilters.statuses.indexOf('unknown') > -1} />
                  <ListItemText 
                    primary={`Unknown (${deviceStatusCount('unknown')})`} 
                  />
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Groups Filter */}
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>
              Groups
            </Typography>
            <FormControl fullWidth className={classes.formControl}>
              <InputLabel>Device Groups</InputLabel>
              <Select
                multiple
                value={localFilters.groups}
                onChange={(e) => handleFilterChange('groups', e.target.value)}
                renderValue={(selected) => selected.length > 0 ? `${selected.length} selected` : 'All groups'}
                className={classes.select}
              >
                {Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)).map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    <Checkbox checked={localFilters.groups.indexOf(group.id) > -1} />
                    <ListItemText primary={group.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Sort Options */}
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>
              Sort By
            </Typography>
            <FormControl fullWidth className={classes.formControl}>
              <InputLabel>Sort Order</InputLabel>
              <Select
                value={localFilters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className={classes.select}
              >
                <MenuItem value="">Default Order</MenuItem>
                <MenuItem value="name">Name (A-Z)</MenuItem>
                <MenuItem value="lastUpdate">Last Update</MenuItem>
                <MenuItem value="status">Status</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Map Options */}
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>
              Map Options
            </Typography>
            <FormGroup className={classes.switchGroup}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={localFilters.mapOnly}
                    onChange={(e) => handleFilterChange('mapOnly', e.target.checked)}
                  />
                }
                label="Show only devices in view"
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={localFilters.cluster}
                    onChange={(e) => handleFilterChange('cluster', e.target.checked)}
                  />
                }
                label="Cluster nearby devices"
              />
            </FormGroup>
          </Box>

          {/* Footer Actions */}
          <Box className={classes.footer}>
            <Button
              variant="text"
              onClick={handleClearFilters}
              startIcon={<ClearIcon />}
              className={classes.clearButton}
            >
              Clear All
            </Button>
            <Button
              variant="contained"
              onClick={handleApplyFilters}
              className={classes.applyButton}
            >
              Apply Filters
            </Button>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

export default FiltersFlyout;
