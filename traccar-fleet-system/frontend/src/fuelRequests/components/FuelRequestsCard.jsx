import {
  Paper, Typography, Grid, Box, Chip, Button, Card, CardContent,
  Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { useMemo, useState } from 'react';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TodayIcon from '@mui/icons-material/Today';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ArchiveIcon from '@mui/icons-material/Archive';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InfoIcon from '@mui/icons-material/Info';
import FuelApprovalDialog from './FuelApprovalDialog';
import FuelRequestsManagementDashboard from './FuelRequestsManagementDashboard';
import { errorsActions } from '../../store';
import { fuelRequestsActions } from '../store/fuelRequests';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';
import { useVehicleDisplayContext } from '../../fleet/display/VehicleDisplayRegistryContext';

const useStyles = makeStyles()((theme) => ({
  paper: {
    padding: 'var(--space-4)',
    height: '100%',
    width: '100%',
    maxWidth: '100%',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'none',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--surface-card)',
    boxSizing: 'border-box',
  },
  statsGrid: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(4),
    width: '100%',
    maxWidth: '100%',
    marginLeft: 0,
    marginRight: 0,
    '& > .MuiGrid-item': {
      paddingTop: theme.spacing(2),
      display: 'flex',
      flex: '1 1 auto', // Equal space distribution
    },
  },
  statCard: {
    height: '100%',
    width: '100%',
    borderRadius: 'var(--radius-md)',
    transition: 'border-color 0.15s ease',
    cursor: 'pointer',
    border: '1px solid var(--color-border)',
    position: 'relative',
    boxShadow: 'none',
    '&:hover': {
      borderColor: 'var(--color-border-hover)',
      transform: 'none',
    },
    '&.active': {
      borderWidth: '2px',
      borderColor: 'var(--color-primary)',
      transform: 'none',
      boxShadow: 'none',
    },
  },
  statCardPending: {
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.08)',
    borderColor: theme.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)',
    '&.active': {
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.15)',
      borderColor: '#F59E0B',
    },
    '& .stat-icon': {
      color: '#F59E0B',
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)',
    },
    '& .stat-value': {
      color: '#F59E0B',
    },
    '& .stat-label': {
      color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
    },
  },
  statCardApproved: {
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)',
    borderColor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
    '&.active': {
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.15)',
      borderColor: '#10B981',
    },
    '& .stat-icon': {
      color: '#10B981',
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
    },
    '& .stat-value': {
      color: '#10B981',
    },
    '& .stat-label': {
      color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
    },
  },
  statCardFulfilled: {
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)',
    borderColor: theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
    '&.active': {
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
      borderColor: '#3B82F6',
    },
    '& .stat-icon': {
      color: '#3B82F6',
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
    },
    '& .stat-value': {
      color: '#3B82F6',
    },
    '& .stat-label': {
      color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
    },
  },
  statCardTotal: {
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(107, 114, 128, 0.15)' : 'rgba(107, 114, 128, 0.08)',
    borderColor: theme.palette.mode === 'dark' ? 'rgba(107, 114, 128, 0.3)' : 'rgba(107, 114, 128, 0.2)',
    '&.active': {
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(107, 114, 128, 0.25)' : 'rgba(107, 114, 128, 0.15)',
      borderColor: '#6B7280',
    },
    '& .stat-icon': {
      color: '#6B7280',
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.15)',
    },
    '& .stat-value': {
      color: '#6B7280',
    },
    '& .stat-label': {
      color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
    },
  },
  statCardContent: {
    padding: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    minHeight: 100,
    height: '100%',
  },
  statCardIconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: '12px',
    flexShrink: 0,
  },
  statCardIcon: {
    fontSize: '1.75rem',
  },
  statCardTextWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    flex: 1,
    textAlign: 'right',
  },
  statCardValue: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    marginBottom: theme.spacing(0.25),
  },
  statCardLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    opacity: 0.8,
  },
  searchFilterBar: {
    marginBottom: theme.spacing(4),
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    padding: theme.spacing(2.5),
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.03)' 
      : 'rgba(0, 0, 0, 0.02)',
    borderRadius: '12px',
    border: `1px solid ${theme.palette.divider}`,
  },
  searchField: {
    flex: '1 1 300px',
    minWidth: 250,
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'var(--surface-card)',
    },
  },
  filterField: {
    minWidth: 160,
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'var(--surface-card)',
    },
  },
  accordionSection: {
    marginBottom: theme.spacing(2),
    '&:before': {
      display: 'none',
    },
    borderRadius: '12px',
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.mode === 'dark'
      ? '0 1px 3px rgba(0, 0, 0, 0.2)'
      : '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  accordionSummary: {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.03)' 
      : 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
    '&.Mui-expanded': {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
  },
  dateGroupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    fontWeight: 600,
    fontSize: '1rem',
  },
  dateGroupCount: {
    marginLeft: 'auto',
    fontWeight: 500,
  },
  requestCard: {
    height: '100%',
    borderRadius: '12px',
    border: `1px solid ${theme.palette.divider}`,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxShadow: theme.palette.mode === 'dark'
      ? '0 1px 2px rgba(0, 0, 0, 0.2)'
      : '0 1px 2px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    '&:hover': {
      boxShadow: theme.palette.mode === 'dark'
        ? '0 4px 12px rgba(0, 0, 0, 0.35)'
        : '0 4px 12px rgba(0, 0, 0, 0.1)',
      borderColor: theme.palette.mode === 'dark' 
        ? 'rgba(255, 255, 255, 0.2)' 
        : 'rgba(0, 0, 0, 0.15)',
    },
  },
  requestCardNew: {
    borderLeft: '3px solid #3B82F6',
  },
  requestCardWarning: {
    borderLeft: '3px solid #F59E0B',
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(245, 158, 11, 0.06)' 
      : 'rgba(245, 158, 11, 0.04)',
  },
  requestCardContent: {
    padding: theme.spacing(2.5),
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  requestHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1.5),
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  requestTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  requestInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(1.5),
  },
  requestInfoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
  },
  requestActions: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    marginTop: 'auto', // Push actions to bottom of card for equal-height cards
    paddingTop: theme.spacing(1.5),
  },
  statusBadge: {
    fontWeight: 600,
    fontSize: '0.75rem',
    padding: theme.spacing(0.5, 1),
  },
  statusPending: {
    backgroundColor: '#F59E0B',
    color: 'white',
  },
  statusApproved: {
    backgroundColor: '#10B981',
    color: 'white',
  },
  statusFulfilled: {
    backgroundColor: '#3B82F6',
    color: 'white',
  },
  statusRejected: {
    backgroundColor: '#EF4444',
    color: 'white',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(6),
  },
  emptyStateIcon: {
    fontSize: '4rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  emptyStateText: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
}));

const FuelRequestsCard = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  
  // Select both items and lastUpdated to ensure re-render on state changes
  // Use shallowEqual to prevent unnecessary re-renders when object reference changes but content doesn't
  const { items: fuelRequestsItems, lastUpdated } = useSelector(
    (state) => ({
      items: state.fuelRequests?.items || {},
      lastUpdated: state.fuelRequests?.lastUpdated,
    }),
    shallowEqual
  );
  
  // Convert to array for easier manipulation
  const fuelRequests = useMemo(() => {
    return fuelRequestsItems; // Keep as object for compatibility
  }, [fuelRequestsItems, lastUpdated]);
  
  const devices = useSelector((state) => state.devices.items);
  const user = useSelector((state) => state.session.user);
  const { getDisplayForDevice } = useVehicleDisplayContext();
  
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // Default to pending only for cleaner view
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [expandedSections, setExpandedSections] = useState({});
  const [approvalDialog, setApprovalDialog] = useState({ open: false, request: null });
  const [processingRequests, setProcessingRequests] = useState(new Set()); // Track requests being processed


  // Calculate statistics
  const stats = useMemo(() => {
    const requests = Object.values(fuelRequests);
    return {
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      fulfilled: requests.filter((r) => r.status === 'fulfilled').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
      total: requests.length,
    };
  }, [fuelRequests]);

  // Group requests by date
  const groupRequestsByDate = (requests) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    requests.forEach((request) => {
      const requestDate = new Date(request.requestTime);
      
      if (requestDate >= today) {
        groups.today.push(request);
      } else if (requestDate >= yesterday) {
        groups.yesterday.push(request);
      } else if (requestDate >= thisWeek) {
        groups.thisWeek.push(request);
      } else {
        groups.older.push(request);
      }
    });

    // Sort each group by time (newest first)
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => new Date(b.requestTime) - new Date(a.requestTime));
    });

    return groups;
  };

  // Filter and group requests
  const filteredAndGroupedRequests = useMemo(() => {
    let filtered = Object.values(fuelRequests);

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((request) => {
        const display = getDisplayForDevice(request.deviceId, devices[request.deviceId]);
        const label = display.secondary
          ? `${display.primary} ${display.secondary}`
          : display.primary;
        return (
          label.toLowerCase().includes(query) ||
          request.reason?.toLowerCase().includes(query) ||
          request.requestedAmount?.toString().includes(query)
        );
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((request) => request.status === statusFilter);
    }

    // Apply vehicle filter
    if (vehicleFilter !== 'all') {
      filtered = filtered.filter((request) => request.deviceId.toString() === vehicleFilter);
    }

    // Group by date
    return groupRequestsByDate(filtered);
  }, [fuelRequests, searchQuery, statusFilter, vehicleFilter, devices, getDisplayForDevice]);

  // Get unique vehicles for filter
  const availableVehicles = useMemo(() => {
    const vehicleIds = new Set();
    Object.values(fuelRequests).forEach((request) => {
      if (devices[request.deviceId]) {
        vehicleIds.add(request.deviceId);
      }
    });
    return Array.from(vehicleIds).map((id) => {
      const display = getDisplayForDevice(id, devices[id]);
      return {
        id,
        name: display.secondary ? `${display.primary} (${display.secondary})` : display.primary,
      };
    });
  }, [fuelRequests, devices, getDisplayForDevice]);

  // Toggle accordion section
  const handleAccordionChange = (section) => (event, isExpanded) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: isExpanded,
    }));
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const requestDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (requestDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Pending', className: classes.statusPending },
      approved: { label: 'Approved', className: classes.statusApproved },
      fulfilled: { label: 'Fulfilled', className: classes.statusFulfilled },
      rejected: { label: 'Rejected', className: classes.statusRejected },
      cancelled: { label: 'Cancelled', className: classes.statusRejected },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Chip
        label={config.label}
        size="small"
        className={`${classes.statusBadge} ${config.className}`}
      />
    );
  };

  // Get urgency chip
  const getUrgencyChip = (urgency) => {
    const urgencyConfig = {
      emergency: { label: 'Emergency', color: 'error' },
      urgent: { label: 'Urgent', color: 'warning' },
      normal: { label: 'Normal', color: 'default' },
    };
    const config = urgencyConfig[urgency] || urgencyConfig.normal;
    return (
      <Chip
        label={config.label}
        size="small"
        color={config.color}
        variant="outlined"
      />
    );
  };

  // Handle approve with optimistic update
  const handleApprove = async (requestId, approvedAmount, notes) => {
    const request = fuelRequests[requestId];
    if (!request) return;

    // Mark as processing
    setProcessingRequests((prev) => new Set(prev).add(requestId));

    // Optimistic update - immediately update UI
    const optimisticUpdate = {
      ...request,
      status: 'approved',
      approvedAmount: approvedAmount || request.requestedAmount,
      reviewTime: new Date().toISOString(),
      reviewerId: user?.id,
      notes: notes || 'Approved by manager',
    };
    
    // Immediately update Redux store for instant UI feedback
    dispatch(fuelRequestsActions.update([optimisticUpdate]));

    try {
      const response = await fetch(`/api/fuel-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: fuelApiAuthHeaders(user),
        credentials: 'include',
        body: JSON.stringify({ 
          approvedAmount,
          notes: notes || 'Approved by manager' 
        }),
      });

      if (!response.ok) {
        // Revert optimistic update on error
        dispatch(fuelRequestsActions.update([request]));
        const error = await response.json().catch(() => ({ error: 'Failed to approve request' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const updatedRequest = await response.json();
      // WebSocket will also update, but this ensures consistency
      dispatch(fuelRequestsActions.update([updatedRequest]));
      
      // Don't show popup notification here - Socket.IO will handle it via FuelSocketController
      // This prevents duplicate notifications
      
      return updatedRequest;
    } catch (error) {
      console.error('Failed to approve request:', error);
      const errorMessage = error?.message || error?.error || 'Failed to approve fuel request. Please try again.';
      dispatch(errorsActions.push(errorMessage));
      throw error;
    } finally {
      // Remove from processing set
      setProcessingRequests((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  // Handle reject with optimistic update
  const handleReject = async (requestId, notes) => {
    const request = fuelRequests[requestId];
    if (!request) return;

    // Mark as processing
    setProcessingRequests((prev) => new Set(prev).add(requestId));

    // Optimistic update - immediately update UI
    const optimisticUpdate = {
      ...request,
      status: 'rejected',
      reviewTime: new Date().toISOString(),
      reviewerId: user?.id,
      notes: notes || 'Request rejected by manager',
    };
    
    // Immediately update Redux store for instant UI feedback
    dispatch(fuelRequestsActions.update([optimisticUpdate]));

    try {
      const response = await fetch(`/api/fuel-requests/${requestId}/reject`, {
        method: 'PUT',
        headers: fuelApiAuthHeaders(user),
        credentials: 'include',
        body: JSON.stringify({ notes: notes || 'Rejected by manager' }),
      });

      if (!response.ok) {
        // Revert optimistic update on error
        dispatch(fuelRequestsActions.update([request]));
        const error = await response.json().catch(() => ({ error: 'Failed to reject request' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const updatedRequest = await response.json();
      // WebSocket will also update, but this ensures consistency
      dispatch(fuelRequestsActions.update([updatedRequest]));
      
      // Don't show popup notification here - Socket.IO will handle it via FuelSocketController
      // This prevents duplicate notifications
      
      return updatedRequest;
    } catch (error) {
      console.error('Failed to reject request:', error);
      const errorMessage = error?.message || error?.error || 'Failed to reject fuel request. Please try again.';
      dispatch(errorsActions.push(errorMessage));
      throw error;
    } finally {
      // Remove from processing set
      setProcessingRequests((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  // Open approval dialog
  const openApprovalDialog = (request) => {
    setApprovalDialog({ open: true, request });
  };

  // Open details dialog (reuse approval dialog for now)
  const openDetailsDialog = (request) => {
    setApprovalDialog({ open: true, request });
  };

  const closeApprovalDialog = () => {
    setApprovalDialog({ open: false, request: null });
  };

  // Render request card
  const renderRequestCard = (request) => {
    const device = devices[request.deviceId];
    const display = getDisplayForDevice(request.deviceId, device);
    const hasWarnings = request.validationWarnings && request.validationWarnings.length > 0;
    const isNew = new Date(request.requestTime) > new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return (
      <Card 
        key={request.id} 
        className={`${classes.requestCard} ${isNew ? classes.requestCardNew : ''} ${hasWarnings ? classes.requestCardWarning : ''}`}
      >
        <CardContent className={classes.requestCardContent}>
          {isNew && (
            <Chip 
              label="New Request" 
              size="small" 
              color="primary" 
              variant="outlined"
              sx={{ mb: 1, fontWeight: 600 }}
            />
          )}
          
          <Box className={classes.requestHeader}>
            <Box className={classes.requestTitle}>
              <Typography variant="h6" fontWeight={700}>
                {display.primary}
              </Typography>
              {display.secondary ? (
                <Typography variant="body2" color="text.secondary">
                  {display.secondary}
                </Typography>
              ) : null}
              {getUrgencyChip(request.urgency)}
              {getStatusBadge(request.status)}
            </Box>
          </Box>

          <Box className={classes.requestInfo}>
            <Box className={classes.requestInfoRow}>
              <PersonIcon fontSize="small" />
              <Typography variant="body2">
                Driver ID: {request.userId}
              </Typography>
            </Box>
            
            <Box className={classes.requestInfoRow}>
              <LocalGasStationIcon fontSize="small" />
              <Typography variant="body2">
                Requested: {request.requestedAmount} L
              </Typography>
              {request.currentFuelLevel && (
                <Typography variant="body2" color="text.secondary">
                  Current: {Math.round(request.currentFuelLevel)}%
                </Typography>
              )}
            </Box>

            <Box className={classes.requestInfoRow}>
              <AccessTimeIcon fontSize="small" />
              <Typography variant="body2">
                {formatDate(request.requestTime)}
              </Typography>
            </Box>

            {request.address && (
              <Box className={classes.requestInfoRow}>
                <LocationOnIcon fontSize="small" />
                <Typography variant="body2">
                  {request.address}
                </Typography>
              </Box>
            )}

            {request.reason && (
              <Box className={classes.requestInfoRow}>
                <InfoIcon fontSize="small" />
                <Typography variant="body2">
                  {request.reason}
                </Typography>
              </Box>
            )}

            {hasWarnings && (
              <Box sx={{ mt: 1, p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
                <Typography variant="caption" fontWeight="bold">
                  Validation Warning
                </Typography>
                {request.managerSuggestion && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    Suggested approval: {request.managerSuggestion} L
                  </Typography>
                )}
              </Box>
            )}
          </Box>

          {user?.administrator && request.status === 'pending' && (
            <Box className={classes.requestActions}>
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => openApprovalDialog(request)}
                disabled={processingRequests.has(request.id)}
              >
                Approve
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => handleReject(request.id, 'Rejected by manager')}
                disabled={processingRequests.has(request.id)}
              >
                {processingRequests.has(request.id) ? 'Processing...' : 'Reject'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<InfoIcon />}
                onClick={() => openDetailsDialog(request)}
                disabled={processingRequests.has(request.id)}
              >
                Review
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render date group
  const renderDateGroup = (title, icon, requests, sectionKey) => {
    if (requests.length === 0) return null;

    return (
      <Accordion
        key={sectionKey}
        expanded={expandedSections[sectionKey] !== false}
        onChange={handleAccordionChange(sectionKey)}
        className={classes.accordionSection}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          className={classes.accordionSummary}
        >
          <Box className={classes.dateGroupHeader}>
            {icon}
            <Typography variant="h6" fontWeight={600}>
              {title}
            </Typography>
            <Chip 
              label={requests.length} 
              size="small" 
              className={classes.dateGroupCount}
              sx={{ ml: 'auto' }}
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2.5}>
            {requests.map((request) => (
              <Grid item xs={12} sm={6} md={4} key={request.id}>
                {renderRequestCard(request)}
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>
    );
  };

  // Empty state
  const renderEmptyState = () => {
    const hasFilters = statusFilter !== 'pending' || vehicleFilter !== 'all' || searchQuery;
    const allRequestsCount = Object.values(fuelRequests).length;
    
    return (
      <Box className={classes.emptyState}>
        <Typography className={classes.emptyStateIcon}>
          {hasFilters ? '🔍' : stats.total === 0 ? '🎉' : '✅'}
        </Typography>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          {hasFilters ? 'No requests found' : stats.total === 0 ? 'All caught up!' : 'All requests processed!'}
        </Typography>
        <Typography variant="body1" className={classes.emptyStateText}>
          {hasFilters 
            ? 'Try adjusting your search or filters to see more results.'
            : stats.total === 0
            ? 'No fuel requests at the moment.'
            : statusFilter === 'pending' 
            ? `All ${allRequestsCount} request${allRequestsCount !== 1 ? 's' : ''} have been processed. Switch to "All" to view completed requests.`
            : 'No fuel requests match your current view.'}
        </Typography>
        {hasFilters && (
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('pending');
              setVehicleFilter('all');
            }}
            sx={{ mt: 2 }}
          >
            Clear Filters
          </Button>
        )}
      </Box>
    );
  };

  return (
    <Paper className={classes.paper}>
      <FuelRequestsManagementDashboard
        classes={classes}
        stats={stats}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        vehicleFilter={vehicleFilter}
        setVehicleFilter={setVehicleFilter}
        availableVehicles={availableVehicles}
      />

        {/* Requests Section */}
        {filteredAndGroupedRequests.today.length === 0 &&
         filteredAndGroupedRequests.yesterday.length === 0 &&
         filteredAndGroupedRequests.thisWeek.length === 0 &&
         filteredAndGroupedRequests.older.length === 0 ? (
          renderEmptyState()
        ) : (
          <Box>
            <Typography variant="h5" fontWeight={700} gutterBottom sx={{ mb: 3, mt: 1 }}>
              Fuel Requests ({filteredAndGroupedRequests.today.length + 
                            filteredAndGroupedRequests.yesterday.length + 
                            filteredAndGroupedRequests.thisWeek.length + 
                            filteredAndGroupedRequests.older.length})
            </Typography>
          
          {renderDateGroup(
            'TODAY',
            <TodayIcon sx={{ color: '#3B82F6' }} />,
            filteredAndGroupedRequests.today,
            'today'
          )}
          
          {renderDateGroup(
            'YESTERDAY',
            <CalendarTodayIcon sx={{ color: '#6B7280' }} />,
            filteredAndGroupedRequests.yesterday,
            'yesterday'
          )}
          
          {renderDateGroup(
            'THIS WEEK',
            <CalendarTodayIcon sx={{ color: '#6B7280' }} />,
            filteredAndGroupedRequests.thisWeek,
            'thisWeek'
          )}
          
          {renderDateGroup(
            'OLDER',
            <ArchiveIcon sx={{ color: '#6B7280' }} />,
            filteredAndGroupedRequests.older,
            'older'
          )}
        </Box>
      )}

      {/* Approval/Details Dialog */}
      <FuelApprovalDialog
        open={approvalDialog.open}
        onClose={closeApprovalDialog}
        request={approvalDialog.request}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </Paper>
  );
};

export default FuelRequestsCard;
