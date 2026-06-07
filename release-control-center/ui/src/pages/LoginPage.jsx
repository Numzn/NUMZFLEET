import React, { useState } from 'react';
import {
  Box, Button, Paper, TextField, Typography, Alert,
} from '@mui/material';
import { useAuth } from '../auth.jsx';
import { createClient } from '../api.js';

export default function LoginPage() {
  const { setToken } = useAuth();
  const [token, setLocalToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const client = createClient(() => token);
      await client.overview();
      setToken(token);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper sx={{ p: 4, width: 420, maxWidth: '95vw' }}>
        <Typography variant="h5" gutterBottom fontWeight={700}>
          Release Control Center
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter the RCC API token from <code>config/rcc.env</code>
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          fullWidth
          label="API Token"
          type="password"
          value={token}
          onChange={(e) => setLocalToken(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Button fullWidth variant="contained" onClick={handleLogin} disabled={!token || loading}>
          Connect
        </Button>
      </Paper>
    </Box>
  );
}
