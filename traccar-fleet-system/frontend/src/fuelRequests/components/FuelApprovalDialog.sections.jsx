import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Alert,
  Button,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  TextField,
  Avatar,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

export const DecisionHeader = ({
  classes,
  request,
  driverName,
}) => (
  <>
    <Box className={classes.headerTopRow}>
      <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ width: 28, height: 28 }}>
          <PersonOutlineIcon fontSize="small" />
        </Avatar>
        <Typography className={classes.driverName} noWrap>{driverName}</Typography>
      </Box>
      <Chip
        label={request.urgency || 'normal'}
        size="small"
        color={request.urgency === 'urgent' ? 'error' : 'default'}
        className={classes.urgencyChip}
      />
    </Box>
  </>
);

export const LiveDataCard = ({
  classes,
  request,
  tankCapacity,
  currentFuelPercent,
  approvedPercentage,
}) => (
  <Box className={classes.decisionHeader}>
    <Typography className={classes.requestLine}>Requested: {request.requestedAmount}L</Typography>
    <Typography className={classes.progressionLine}>
      Tank: {Number.isFinite(tankCapacity) ? `${Math.round(tankCapacity)}L` : 'Not configured'}
      {' '}({Math.round(currentFuelPercent)}% {'->'} {Math.round(approvedPercentage)}%)
    </Typography>
    <Box sx={{ mt: 1 }}>
      <Slider
        value={Math.round(Math.max(0, approvedPercentage))}
        min={0}
        max={100}
        step={1}
        disabled
        size="small"
        aria-label="fuel projection"
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography className={classes.helperText}>0%</Typography>
        <Typography className={classes.helperText}>100%</Typography>
      </Box>
    </Box>
    <Typography className={classes.liveDataMeta}>
      Live data source: Traccar position + vehicle spec
    </Typography>
  </Box>
);

export const RecommendationCard = ({ classes, suggestedAmount, onUseRecommendation }) => (
  <Box className={classes.recommendationBox}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <InfoOutlinedIcon color="primary" fontSize="small" />
      <Typography className={classes.recommendationTitle}>Recommended: Approve up to {suggestedAmount}L</Typography>
    </Box>
    <Button size="small" variant="contained" color="primary" onClick={onUseRecommendation} className={classes.compactActionButton}>
      Use Recommendation
    </Button>
  </Box>
);

export const ApprovalAmountSection = ({
  classes,
  safeApprovedAmount,
  roundedMaxPossible,
  requestedAmount,
  onChangeAmount,
  onMatchRequested,
  onFillTank,
}) => (
  <Box className={classes.sliderWrap}>
    <Box className={classes.sliderHeader}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.84rem' }}>Approve Amount</Typography>
      <Typography className={classes.sliderValue}>{safeApprovedAmount}L</Typography>
    </Box>
    <Slider
      value={Math.min(safeApprovedAmount, roundedMaxPossible)}
      min={0}
      max={Math.max(roundedMaxPossible, 1)}
      step={1}
      onChange={(_, value) => onChangeAmount(Number(value))}
      valueLabelDisplay="auto"
      color="success"
      aria-label="approved amount slider"
      sx={{ py: 0.5 }}
    />
    <Typography className={classes.helperText}>Max: {roundedMaxPossible}L</Typography>
    <Box className={classes.quickActions}>
      <Button size="small" variant="outlined" className={classes.compactActionButton} onClick={onMatchRequested}>
        Match Requested ({requestedAmount}L)
      </Button>
      <Button size="small" variant="outlined" className={classes.compactActionButton} onClick={onFillTank}>
        Fill Tank ({roundedMaxPossible}L)
      </Button>
    </Box>
  </Box>
);

export const DetailsSection = ({ classes, requestReason, tankCapacity }) => (
  <Accordion className={classes.detailsAccordion}>
    <AccordionSummary
      expandIcon={<ExpandMoreIcon />}
      sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center' } }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, flexGrow: 1 }}>Details</Typography>
      <MoreHorizIcon fontSize="small" color="action" />
    </AccordionSummary>
    <AccordionDetails>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>Reason: {requestReason || 'No reason provided'}</Typography>
      <Typography variant="body2" color="text.secondary">Tank Capacity: {Number.isFinite(tankCapacity) ? `${Math.round(tankCapacity)}L` : 'Not configured'}</Typography>
    </AccordionDetails>
  </Accordion>
);

export const NotesSection = ({ classes, isMobile, notes, setNotes }) => (
  <>
    <Divider sx={{ mt: 1.25 }} />
    <Box className={classes.notesWrap}>
      <Typography variant="caption" sx={{ fontWeight: 600 }} gutterBottom>Add note (optional)</Typography>
      <TextField
        label="Note"
        multiline
        rows={isMobile ? 2 : 3}
        size="small"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        fullWidth
        placeholder="Add context for the driver or audit trail"
      />
    </Box>
  </>
);

export const ValidationAlerts = ({ classes, validationError, hasWarnings, validationWarnings }) => (
  <>
    {validationError && <Alert severity="info" sx={{ mt: 1.25 }}>{validationError}. Using latest available request data.</Alert>}
    {hasWarnings && (
      <Alert severity="warning" className={classes.validationAlert}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Validation Warning</Typography>
        {validationWarnings.map((warning, index) => (
          <Typography key={index} variant="body2">{warning.message || warning}</Typography>
        ))}
      </Alert>
    )}
  </>
);
