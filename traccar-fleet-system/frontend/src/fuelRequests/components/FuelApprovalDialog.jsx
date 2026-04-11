import React, { useEffect, useState } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, Box, Typography, LinearProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch, useSelector } from 'react-redux';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { errorsActions } from '../../store';
import { useFuelApprovalDialogStyles } from './FuelApprovalDialog.styles';
import { DecisionHeader, LiveDataCard, RecommendationCard, ApprovalAmountSection, DetailsSection, NotesSection, ValidationAlerts } from './FuelApprovalDialog.sections';
import { useFuelApprovalLiveData, useFuelApprovalDerivedData } from './FuelApprovalDialog.data';

const FuelApprovalDialog = ({ open, onClose, request, onApprove, onReject }) => {
  const { classes } = useFuelApprovalDialogStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);
  const device = useSelector((state) => (request ? state.devices.items[request.deviceId] : null));
  const latestPosition = useSelector((state) => (request ? state.session.positions[request.deviceId] : null));
  const [approvedAmount, setApprovedAmount] = useState(request?.requestedAmount || 0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const {
    validationData,
    validationError,
    setValidationData,
    setValidationError,
  } = useFuelApprovalLiveData({ open, request, userId: user?.id });

  const derived = useFuelApprovalDerivedData({
    request,
    device,
    latestPosition,
    validationData,
    approvedAmount,
  });

  useEffect(() => {
    if (request) {
      setApprovedAmount(request.managerSuggestion || request.requestedAmount);
      setNotes('');
      setValidationData(null);
      setValidationError(null);
    }
  }, [request, setValidationData, setValidationError]);

  if (!request) return null;

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await onApprove(request.id, approvedAmount, notes);
      onClose();
    } catch (error) {
      console.error('Failed to approve request:', error);
      const errorMessage = error?.message || error?.error || 'Failed to approve fuel request. Please try again.';
      setError(errorMessage);
      dispatch(errorsActions.push(errorMessage));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError(null);
    try {
      await onReject(request.id, notes);
      onClose();
    } catch (error) {
      console.error('Failed to reject request:', error);
      const errorMessage = error?.message || error?.error || 'Failed to reject fuel request. Please try again.';
      setError(errorMessage);
      dispatch(errorsActions.push(errorMessage));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      fullScreen={isMobile}
      className={classes.dialog}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 1.25,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle sx={{ pb: 0.5, pt: 1.2, px: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ArrowBackIcon fontSize="small" color="action" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }} noWrap>
              {derived.deviceName}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: isMobile ? 8 : 1.25, px: 1.5 }}>
        <DecisionHeader
          classes={classes}
          request={request}
          driverName={derived.driverName}
        />
        <LiveDataCard
          classes={classes}
          request={request}
          tankCapacity={derived.tankCapacity}
          currentFuelPercent={derived.currentFuelPercent}
          roundedMaxPossible={derived.roundedMaxPossible}
          approvedPercentage={derived.approvedPercentage}
        />
        <ValidationAlerts
          classes={classes}
          validationError={validationError}
          hasWarnings={derived.hasWarnings}
          validationWarnings={derived.validationWarnings}
        />
        {derived.suggestionDiffers && (
          <RecommendationCard
            classes={classes}
            suggestedAmount={derived.suggestedAmount}
            onUseRecommendation={() => setApprovedAmount(derived.suggestedAmount)}
          />
        )}
        <ApprovalAmountSection
          classes={classes}
          safeApprovedAmount={derived.safeApprovedAmount}
          roundedMaxPossible={derived.roundedMaxPossible}
          requestedAmount={request.requestedAmount}
          onChangeAmount={setApprovedAmount}
          onMatchRequested={() => setApprovedAmount(request.requestedAmount)}
          onFillTank={() => setApprovedAmount(derived.roundedMaxPossible)}
        />
        {derived.approvedExceedsMax && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Approved amount exceeds available space. Reduce to {derived.roundedMaxPossible}L or less.
          </Alert>
        )}
        <DetailsSection classes={classes} requestReason={request.reason} tankCapacity={derived.tankCapacity} />
        <NotesSection classes={classes} isMobile={isMobile} notes={notes} setNotes={setNotes} />
        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {loading && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>

      <DialogActions className={isMobile ? classes.stickyActions : classes.desktopActions}>
        {!isMobile && (
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleReject}
          color="error"
          startIcon={<CancelIcon />}
          disabled={loading}
          variant={isMobile ? 'outlined' : 'text'}
          size="small"
          className={classes.actionButton}
          sx={{ flex: 1 }}
        >
          Reject
        </Button>
        <Button
          onClick={handleApprove}
          color="success"
          startIcon={<CheckCircleIcon />}
          disabled={loading || derived.safeApprovedAmount <= 0 || derived.approvedExceedsMax}
          variant="contained"
          size="small"
          className={classes.primaryActionButton}
          sx={{ flex: 1 }}
        >
          Approve {derived.safeApprovedAmount}L
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FuelApprovalDialog;
