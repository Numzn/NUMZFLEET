import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    minHeight: '200px',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: '4rem',
    marginBottom: theme.spacing(2),
  },
  errorTitle: {
    marginBottom: theme.spacing(1),
    fontWeight: 'bold',
  },
  errorMessage: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  retryButton: {
    marginTop: theme.spacing(2),
  },
}));

const MapErrorFallback = ({ error, onRetry }) => {
  const { classes } = useStyles();

  return (
    <Box className={classes.errorContainer}>
      <Typography variant="h4" className={classes.errorIcon}>
        🗺️
      </Typography>
      <Typography variant="h6" className={classes.errorTitle}>
        Map Error
      </Typography>
      <Typography variant="body2" className={classes.errorMessage}>
        Something went wrong with the map display. This might be due to a connection issue or a problem with the map data.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ marginBottom: 2, maxWidth: 400 }}>
          <Typography variant="caption">
            {error.message || 'Unknown error occurred'}
          </Typography>
        </Alert>
      )}
      {onRetry && (
        <Button 
          variant="contained" 
          color="primary" 
          onClick={onRetry}
          className={classes.retryButton}
        >
          Retry
        </Button>
      )}
    </Box>
  );
};

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Map Error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <MapErrorFallback 
          error={this.state.error} 
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

export default MapErrorBoundary;








