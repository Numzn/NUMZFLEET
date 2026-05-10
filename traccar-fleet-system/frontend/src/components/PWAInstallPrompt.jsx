import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';

/**
 * PWA Install Prompt Component
 * Shows a dialog prompting users to install the app as a PWA
 */
const PWAInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      // Prevent the default browser install prompt
      event.preventDefault();
      setInstallPrompt(event);

      // Check if already installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const wasDismissed = localStorage.getItem('pwaPromptDismissed');
      const dismissedTime = wasDismissed ? parseInt(wasDismissed, 10) : 0;
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

      // Show prompt if not installed and not dismissed in last 30 days
      if (!isStandalone && daysSinceDismissed > 30) {
        setIsVisible(true);
      }
    };

    const handleAppInstalled = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ [PWA] App installed');
      }
      setInstallPrompt(null);
      setIsVisible(false);
      localStorage.removeItem('pwaPromptDismissed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[PWA] User choice: ${outcome}`);
    }

    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsVisible(false);
      localStorage.removeItem('pwaPromptDismissed');
    } else {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Store dismissal in localStorage to not show again for 30 days
    localStorage.setItem('pwaPromptDismissed', Date.now().toString());
  };

  if (!isVisible) return null;

  return (
    <Dialog open={isVisible} onClose={handleDismiss} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <span role="img" aria-label="rocket">
            🚀
          </span>
          <Typography variant="h6">Install Fuel Management App</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Install the app for a better experience:
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 2 }}>
          • ⚡ Fast loading with offline support
          <br />
          • 🔔 Push notifications for instant updates
          <br />
          • 📱 App-like experience without browser
          <br />
          • 🏠 Quick access from your home screen
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDismiss} color="primary">
          Maybe Later
        </Button>
        <Button onClick={handleInstall} variant="contained" color="primary">
          Install App
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PWAInstallPrompt;



