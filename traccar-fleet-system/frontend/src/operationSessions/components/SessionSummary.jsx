import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { closeOperationSession } from '../api/operationSessionsApi';

const SessionSummary = ({ sessions = [], selectedSessionId, onSelectSession, onSessionClosed }) => {
  const user = useSelector((state) => state.session.user);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState(null);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const handleClose = async () => {
    if (!selectedSessionId || !user) return;
    setClosing(true);
    setCloseError(null);
    try {
      await closeOperationSession(user, selectedSessionId);
      onSessionClosed?.(selectedSessionId);
    } catch (err) {
      setCloseError(err.message || 'Failed to close session');
    } finally {
      setClosing(false);
    }
  };

  return (
    <Stack spacing={1}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Sessions</Typography>
        {selectedSession?.status === 'active' && (
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={closing ? <CircularProgress size={14} /> : <LockIcon />}
            onClick={handleClose}
            disabled={closing}
          >
            {closing ? 'Closing...' : 'Close Session'}
          </Button>
        )}
      </Box>
      {closeError && (
        <Typography variant="caption" color="error">{closeError}</Typography>
      )}
      <Paper variant="outlined">
        <List dense disablePadding>
          {sessions.length === 0 && (
            <ListItemButton disabled>
              <ListItemText primary="No sessions found" secondary="Create a session to start logging refuels." />
            </ListItemButton>
          )}
          {sessions.map((session) => (
            <ListItemButton
              key={session.id}
              selected={selectedSessionId === session.id}
              onClick={() => onSelectSession?.(session.id)}
            >
              <ListItemText
                primary={session.name || `Session ${session.id}`}
                secondary={session.sessionDate || session.createdAt || 'No date'}
              />
              <Chip
                label={session.status}
                size="small"
                color={session.status === 'active' ? 'success' : 'default'}
                sx={{ ml: 1 }}
              />
            </ListItemButton>
          ))}
        </List>
      </Paper>
    </Stack>
  );
};

export default SessionSummary;
