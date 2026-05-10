import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  Divider,
  Alert,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useToastNotifications } from '../hooks/useToastNotifications';

/**
 * Test component for toast notifications
 * This component allows testing all notification types and features
 */
const ToastNotificationTest = () => {
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  
  const {
    showToast,
    ToastNotification,
    browserNotificationSupported,
    browserNotificationEnabled,
    browserNotificationPermission,
    requestBrowserNotificationPermission,
  } = useToastNotifications({
    enableBrowserNotifications: browserNotificationsEnabled,
    autoRequestPermission: false,
  });

  const testSuccess = () => {
    showToast('This is a success notification! Your fuel request has been approved.', 'success');
  };

  const testError = () => {
    showToast('This is an error notification! Your fuel request has been rejected: Insufficient budget.', 'error');
  };

  const testWarning = () => {
    showToast('This is a warning notification! Your fuel request has been cancelled.', 'warning');
  };

  const testInfo = () => {
    showToast('This is an info notification! New fuel request for 50L from device 123.', 'info');
  };

  const testMultiple = () => {
    showToast('First notification - Success', 'success');
    setTimeout(() => showToast('Second notification - Error', 'error'), 200);
    setTimeout(() => showToast('Third notification - Warning', 'warning'), 400);
    setTimeout(() => showToast('Fourth notification - Info', 'info'), 600);
  };

  const testLongMessage = () => {
    showToast(
      'This is a very long notification message to test how the notification handles longer text content. It should wrap properly and remain readable.',
      'info'
    );
  };

  const testShortDuration = () => {
    showToast('This notification will disappear quickly (1.5 seconds)', 'info', 1500);
  };

  const testLongDuration = () => {
    showToast('This notification will stay longer (5 seconds)', 'success', 5000);
  };

  const testRealWorldScenarios = () => {
    // Simulate real-world fuel request scenarios
    showToast('New fuel request for 50L from device 123', 'info');
    setTimeout(() => {
      showToast('Your fuel request for 50L has been approved', 'success');
    }, 1000);
    setTimeout(() => {
      showToast('Your fuel request has been rejected: Insufficient budget', 'error');
    }, 2000);
    setTimeout(() => {
      showToast('Your fuel request has been cancelled', 'warning');
    }, 3000);
    setTimeout(() => {
      showToast('Fuel request for 50L has been fulfilled', 'success');
    }, 4000);
  };

  const handleBrowserNotificationToggle = async (event) => {
    const enabled = event.target.checked;
    setBrowserNotificationsEnabled(enabled);
    
    if (enabled && browserNotificationPermission !== 'granted') {
      const granted = await requestBrowserNotificationPermission();
      if (!granted) {
        setBrowserNotificationsEnabled(false);
        setShowPermissionDialog(true);
      }
    }
  };

  const getBrowserName = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) return 'Chrome';
    if (userAgent.includes('firefox')) return 'Firefox';
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'Safari';
    if (userAgent.includes('edg')) return 'Edge';
    return 'Your Browser';
  };

  const getInstructionsForBrowser = () => {
    const browser = getBrowserName();
    const instructions = {
      Chrome: [
        'Click the lock icon (🔒) or information icon (ℹ️) in the address bar',
        'Find "Notifications" in the dropdown menu',
        'Select "Allow" from the dropdown',
        'Refresh the page',
      ],
      Firefox: [
        'Click the lock icon (🔒) in the address bar',
        'Click "More Information"',
        'Go to the "Permissions" tab',
        'Find "Notifications" and click "Allow"',
        'Close the window and refresh the page',
      ],
      Safari: [
        'Click Safari in the menu bar',
        'Select "Settings" (or "Preferences")',
        'Go to "Websites" tab',
        'Click "Notifications" in the left sidebar',
        'Find your site and select "Allow" from the dropdown',
      ],
      Edge: [
        'Click the lock icon (🔒) in the address bar',
        'Find "Notifications" in the dropdown menu',
        'Select "Allow" from the dropdown',
        'Refresh the page',
      ],
    };
    return instructions[browser] || instructions.Chrome;
  };

  const testBrowserNotification = () => {
    // Test browser notification (will only show if tab is not focused)
    showToast('This is a browser notification test! Switch to another tab to see it appear outside the app.', 'info');
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        🧪 Toast Notification System Test
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Test all notification types and features of the toast notification system.
      </Typography>

      {/* Browser Notification Settings */}
      {browserNotificationSupported && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.light', color: 'info.contrastText' }}>
          <Typography variant="h6" gutterBottom>
            🌐 Browser Notifications (Free - Native API)
          </Typography>
          <Typography variant="body2" paragraph>
            Enable browser notifications to receive alerts even when the app tab is not active.
            Uses the free Browser Notifications API - no third-party services required!
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={browserNotificationsEnabled && browserNotificationEnabled}
                onChange={handleBrowserNotificationToggle}
                disabled={browserNotificationPermission === 'denied'}
              />
            }
            label={
              browserNotificationPermission === 'denied'
                ? 'Notifications blocked - Please enable in browser settings'
                : browserNotificationEnabled
                ? 'Browser notifications enabled'
                : 'Enable browser notifications'
            }
          />
          {browserNotificationPermission === 'default' && (
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Click the switch above to request notification permission
            </Typography>
          )}
          {browserNotificationEnabled && (
            <Button
              variant="outlined"
              size="small"
              onClick={testBrowserNotification}
              sx={{ mt: 1 }}
            >
              Test Browser Notification (switch tabs first)
            </Button>
          )}
        </Paper>
      )}

      {!browserNotificationSupported && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Browser notifications are not supported in this browser.
        </Alert>
      )}

      <ToastNotification />

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Basic Notification Types */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Basic Notification Types
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="contained" color="success" onClick={testSuccess}>
                Success Notification
              </Button>
              <Button variant="contained" color="error" onClick={testError}>
                Error Notification
              </Button>
              <Button variant="contained" color="warning" onClick={testWarning}>
                Warning Notification
              </Button>
              <Button variant="contained" color="info" onClick={testInfo}>
                Info Notification
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Advanced Features */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Advanced Features
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={testMultiple}>
                Multiple Notifications
              </Button>
              <Button variant="outlined" onClick={testLongMessage}>
                Long Message Test
              </Button>
              <Button variant="outlined" onClick={testShortDuration}>
                Short Duration (1.5s)
              </Button>
              <Button variant="outlined" onClick={testLongDuration}>
                Long Duration (5s)
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Real-World Scenarios */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Real-World Scenarios
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" paragraph>
              Simulates actual fuel request workflow notifications
            </Typography>
            <Button variant="contained" color="primary" onClick={testRealWorldScenarios}>
              Test Fuel Request Flow
            </Button>
          </Paper>
        </Grid>

        {/* Test Checklist */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Test Checklist
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box component="ul" sx={{ pl: 2 }}>
              <li>✅ All notification types display correctly (success, error, warning, info)</li>
              <li>✅ Icons appear for each notification type</li>
              <li>✅ Notifications stack vertically at top-right</li>
              <li>✅ Close button works for manual dismissal</li>
              <li>✅ Auto-dismiss works after duration</li>
              <li>✅ Multiple notifications can appear simultaneously</li>
              <li>✅ Long messages wrap properly</li>
              <li>✅ Custom durations work correctly</li>
              <li>✅ Colors match notification types</li>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Permission Help Dialog */}
      <Dialog
        open={showPermissionDialog}
        onClose={() => setShowPermissionDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          🔔 How to Enable Browser Notifications
        </DialogTitle>
        <DialogContent>
          <DialogContentText paragraph>
            To enable browser notifications, you need to allow them in your browser settings.
            Browser notifications will appear outside the app even when the tab is not active.
          </DialogContentText>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Steps for {getBrowserName()}:
          </Typography>

          <List>
            {getInstructionsForBrowser().map((step, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <CheckCircleIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary={step} />
              </ListItem>
            ))}
          </List>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Quick Method:</strong> Look for the lock/info icon in your browser's address bar,
              then find "Notifications" and change it to "Allow". Refresh the page after changing.
            </Typography>
          </Alert>

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Note:</strong> If you previously denied permission, you'll need to reset it first
              in your browser settings before you can enable notifications.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPermissionDialog(false)}>
            Close
          </Button>
          <Button
            onClick={async () => {
              setShowPermissionDialog(false);
              // Try requesting permission again after user has seen instructions
              const granted = await requestBrowserNotificationPermission();
              if (granted) {
                setBrowserNotificationsEnabled(true);
              }
            }}
            variant="contained"
            color="primary"
          >
            Try Again
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ToastNotificationTest;

