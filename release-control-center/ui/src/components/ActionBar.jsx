import React, { useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography, Alert,
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import PublishIcon from '@mui/icons-material/Publish';
import UndoIcon from '@mui/icons-material/Undo';

export default function ActionBar({ overview, client, onJobStarted, disabled }) {
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [promoteSha, setPromoteSha] = useState('');
  const [confirmPromote, setConfirmPromote] = useState('');
  const [confirmRollback, setConfirmRollback] = useState('');
  const [error, setError] = useState('');

  const run = async (fn) => {
    setError('');
    try {
      const result = await fn(client);
      onJobStarted(result.jobId);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<VerifiedIcon />}
          disabled={disabled}
          onClick={() => run((c) => c.verify())}
        >
          Run Verification
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<PublishIcon />}
          disabled={disabled}
          onClick={() => setPromoteOpen(true)}
        >
          Deploy SHA to Production
        </Button>
        <Button
          variant="outlined"
          color="warning"
          startIcon={<UndoIcon />}
          disabled={disabled}
          onClick={() => setRollbackOpen(true)}
        >
          Rollback Production
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      <PromoteDialog
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        sha={promoteSha}
        setSha={setPromoteSha}
        confirm={confirmPromote}
        setConfirm={setConfirmPromote}
        onConfirm={() => run((c) => c.promote({
          promotedSha: promoteSha,
          confirmPhrase: 'PROMOTE',
        }))}
      />

      <RollbackDialog
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        confirm={confirmRollback}
        setConfirm={setConfirmRollback}
        previousSha={overview?.production?.deployHistory?.slice(-2, -1)?.[0]}
        onConfirm={() => run((c) => c.rollbackProduction({ confirmPhrase: 'ROLLBACK' }))}
      />
    </Box>
  );
}

const SHA_RE = /^[0-9a-fA-F]{40}$/;

function PromoteDialog({ open, onClose, sha, setSha, confirm, setConfirm, onConfirm }) {
  const shaValid = SHA_RE.test(sha);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Deploy SHA to Production</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Rollback does not revert DB migrations. Restore baseline backup if needed.
        </Alert>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Break-glass path: bypasses the normal <code>git push origin main</code> pipeline and directly
          runs <code>auto_deploy.py --target production --promoted-sha … --skip-git</code> for an
          already-built SHA (images must already exist in Docker Hub).
        </Typography>
        <TextField
          fullWidth
          label="Full 40-character git SHA"
          value={sha}
          onChange={(e) => setSha(e.target.value.trim())}
          error={sha.length > 0 && !shaValid}
          helperText={sha.length > 0 && !shaValid ? 'Must be a full 40-character SHA' : ' '}
          sx={{ mb: 1 }}
        />
        <TextField
          fullWidth
          label='Type PROMOTE to confirm'
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="success"
          disabled={confirm !== 'PROMOTE' || !shaValid}
          onClick={() => { onConfirm(); onClose(); }}
        >
          Deploy
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RollbackDialog({ open, onClose, confirm, setConfirm, previousSha, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Rollback Production</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Runs <code>rollback.sh</code> on OCI. Does not revert database schema/data.
        </Alert>
        {previousSha && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Previous SHA: <code>{previousSha}</code>
          </Typography>
        )}
        <TextField
          fullWidth
          label='Type ROLLBACK to confirm'
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="warning"
          disabled={confirm !== 'ROLLBACK'}
          onClick={() => { onConfirm(); onClose(); }}
        >
          Rollback
        </Button>
      </DialogActions>
    </Dialog>
  );
}
