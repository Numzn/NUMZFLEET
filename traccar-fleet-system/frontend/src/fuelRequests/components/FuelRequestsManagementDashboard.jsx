import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import PendingIcon from '@mui/icons-material/Pending';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SearchIcon from '@mui/icons-material/Search';

const FuelRequestsManagementDashboard = ({
  classes,
  stats,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  vehicleFilter,
  setVehicleFilter,
  availableVehicles,
}) => {
  return (
    <>
      <Grid container spacing={3} className={classes.statsGrid} sx={{ width: '100%', marginLeft: 0, marginRight: 0 }}>
        <Grid item xs={6} sm={6} md={3} sx={{ display: 'flex', flexGrow: 1 }}>
          <Card
            className={`${classes.statCard} ${classes.statCardPending} ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            <CardContent className={classes.statCardContent}>
              <Box className={`${classes.statCardIconWrapper} stat-icon`}>
                <PendingIcon className={classes.statCardIcon} />
              </Box>
              <Box className={classes.statCardTextWrapper}>
                <Typography className={`${classes.statCardValue} stat-value`}>{stats.pending}</Typography>
                <Typography className={`${classes.statCardLabel} stat-label`}>Pending</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={6} md={3} sx={{ display: 'flex', flexGrow: 1 }}>
          <Card
            className={`${classes.statCard} ${classes.statCardApproved} ${statusFilter === 'approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            <CardContent className={classes.statCardContent}>
              <Box className={`${classes.statCardIconWrapper} stat-icon`}>
                <CheckCircleIcon className={classes.statCardIcon} />
              </Box>
              <Box className={classes.statCardTextWrapper}>
                <Typography className={`${classes.statCardValue} stat-value`}>{stats.approved}</Typography>
                <Typography className={`${classes.statCardLabel} stat-label`}>Approved</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={6} md={3} sx={{ display: 'flex', flexGrow: 1 }}>
          <Card
            className={`${classes.statCard} ${classes.statCardFulfilled} ${statusFilter === 'fulfilled' ? 'active' : ''}`}
            onClick={() => setStatusFilter('fulfilled')}
          >
            <CardContent className={classes.statCardContent}>
              <Box className={`${classes.statCardIconWrapper} stat-icon`}>
                <CheckCircleIcon className={classes.statCardIcon} />
              </Box>
              <Box className={classes.statCardTextWrapper}>
                <Typography className={`${classes.statCardValue} stat-value`}>{stats.fulfilled}</Typography>
                <Typography className={`${classes.statCardLabel} stat-label`}>Fulfilled</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={6} md={3} sx={{ display: 'flex', flexGrow: 1 }}>
          <Card
            className={`${classes.statCard} ${classes.statCardTotal} ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className={classes.statCardContent}>
              <Box className={`${classes.statCardIconWrapper} stat-icon`}>
                <AssessmentIcon className={classes.statCardIcon} />
              </Box>
              <Box className={classes.statCardTextWrapper}>
                <Typography className={`${classes.statCardValue} stat-value`}>{stats.total}</Typography>
                <Typography className={`${classes.statCardLabel} stat-label`}>Total</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box className={classes.searchFilterBar}>
        <TextField
          className={classes.searchField}
          placeholder="Search requests..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          variant="outlined"
          size="medium"
        />

        <FormControl className={classes.filterField} size="medium">
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="fulfilled">Fulfilled</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>

        <FormControl className={classes.filterField} size="medium">
          <InputLabel>Vehicle</InputLabel>
          <Select
            value={vehicleFilter}
            label="Vehicle"
            onChange={(e) => setVehicleFilter(e.target.value)}
          >
            <MenuItem value="all">All Vehicles</MenuItem>
            {availableVehicles.map((vehicle) => (
              <MenuItem key={vehicle.id} value={vehicle.id.toString()}>
                {vehicle.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </>
  );
};

export default FuelRequestsManagementDashboard;
