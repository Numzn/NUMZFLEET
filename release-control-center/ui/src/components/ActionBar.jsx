import React, { useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography, Alert, FormControlLabel, Checkbox,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import VerifiedIcon from '@mui/icons-material/Verified';
import PublishIcon from '@mui/icons-material/Publish';
import UndoIcon from '@mui/icons-material/Undo';

export default function ActionBar({ overview, client, onJobStarted, disabled }) {
  const stagingSha = overview?.staging?.sha;
  const [deployOpen, setDeployOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [skipGit, setSkipGit] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
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
          variant="contained"
          startIcon={<RocketLaunchIcon />}
          disabled={disabled}
          onClick={() => setDeployOpen(true)}
        >
          Deploy to NumzLab
        </Button>
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
          disabled={disabled || !stagingSha || !overview?.promotionGate?.eligible}
          onClick={() => setPromoteOpen(true)}
        >
          Promote to Production
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

      <DeployDialog
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
        skipGit={skipGit}
        setSkipGit={setSkipGit}
        commitMsg={commitMsg}
        setCommitMsg={setCommitMsg}
        onConfirm={() => run((c) => c.deployStaging({
          skipGit,
          message: commitMsg || undefined,
        }))}
      />

      <PromoteDialog
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        stagingSha={stagingSha}
        confirm={confirmPromote}
        setConfirm={setConfirmPromote}
        onConfirm={() => run((c) => c.promote({
          promotedSha: stagingSha,
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

function DeployDialog({ open, onClose, skipGit, setSkipGit, commitMsg, setCommitMsg, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Deploy to NumzLab</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Runs <code>auto_deploy.py --target staging</code> (commit/push + CI wait + SSH deploy).
        </Typography>
        <FormControlLabel
          control={<Checkbox checked={skipGit} onChange={(e) => setSkipGit(e.target.checked)} />}
          label="Skip git commit/push (--skip-git)"
        />
        {!skipGit && (
          <TextField
            fullWidth
            label="Commit message (optional)"
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            sx={{ mt: 1 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { onConfirm(); onClose(); }}>Deploy</Button>
      </DialogActions>
    </Dialog>
  );
}

function PromoteDialog({ open, onClose, stagingSha, confirm, setConfirm, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Promote to Production</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Rollback does not revert DB migrations. Restore baseline backup if needed.
        </Alert>
        <Typography variant="body2" sx={{ mb: 1 }}>
          SHA: <code>{stagingSha}</code>
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Runs <code>auto_deploy.py --target production --promoted-sha … --skip-git</code>
        </Typography>
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
          disabled={confirm !== 'PROMOTE'}
          onClick={() => { onConfirm(); onClose(); }}
        >
          Promote
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
