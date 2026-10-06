import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinkIcon from '@mui/icons-material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import { Scanner } from '@yudiel/react-qr-scanner';
import { devicesActions } from '../store';
import SelectField from '../common/components/SelectField';
import deviceCategories from '../common/util/deviceCategories';
import { useTranslation } from '../common/components/LocalizationProvider';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../config/fuelApiAuth.js';
import { fetchFleetDeviceSnapshot, updateFleetDevice } from '../fleet/fleetDevicesApi.js';

const registrationSteps = ['Method', 'IMEI', 'Confirm', 'Complete'];

const normaliseImei = (value) => value.replace(/\D/g, '').slice(0, 15);

const extractImei = (value) => {
  const raw = String(value || '');
  const exactDigits = raw.replace(/\D/g, '');
  if (exactDigits.length === 15) return exactDigits;
  const match = raw.match(/\d{15}/);
  return match ? match[0] : '';
};

const getRegistrationError = (error) => {
  if (error?.status === 409) {
    return 'This GPS tracker is already registered. Check the IMEI and try again.';
  }
  if (error?.status === 403) {
    return 'You do not have permission to register a GPS tracker.';
  }
  if (error?.status === 400) {
    return 'Please check the tracker name and 15-digit IMEI.';
  }
  return 'We could not register this GPS tracker. Please check the details and try again.';
};

// The camera can fail for different reasons (blocked permission, no camera,
// plain-http origin). Say which one it is so the user knows what to fix.
const getCameraError = (error) => {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'The camera only works on a secure (https) connection. Enter the IMEI manually instead.';
  }
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'Camera access is blocked. Allow camera access for this site in your browser settings, or enter the IMEI manually.';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
    return 'No camera was found on this device. Enter the IMEI manually instead.';
  }
  return 'We could not start the camera. Try again, or enter the IMEI manually.';
};

function BarcodeScanner({ onDetected, onCancel }) {
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  const handleScan = useCallback((codes) => {
    const rawValue = codes?.[0]?.rawValue || codes?.[0]?.value || '';
    if (!rawValue) return;

    const imei = extractImei(rawValue);
    if (imei) {
      setHint('');
      onDetected(imei);
    } else {
      setHint('That code does not contain a 15-digit IMEI. Keep scanning, or enter the IMEI manually.');
    }
  }, [onDetected]);

  return (
    <Stack spacing={2}>
      {error ? (
        <Stack spacing={2}>
          <Alert severity="warning">{error}</Alert>
          <Button variant="outlined" onClick={() => setError('')}>
            Try again
          </Button>
        </Stack>
      ) : (
        <Box
          sx={{
            overflow: 'hidden',
            borderRadius: 2,
            bgcolor: 'common.black',
            minHeight: 280,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Scanner
            constraints={{ facingMode: 'environment' }}
            components={{ finder: true, torch: true }}
            onScan={handleScan}
            onError={(cameraError) => setError(getCameraError(cameraError))}
            styles={{
              container: { width: '100%', maxWidth: 520 },
              video: { width: '100%', display: 'block' },
            }}
          />
        </Box>
      )}
      {hint && !error && <Alert severity="info">{hint}</Alert>}
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Position the barcode or QR code on the GPS tracker inside the frame.
      </Typography>
      <Button startIcon={<ArrowBackIcon />} onClick={onCancel}>
        Enter IMEI manually
      </Button>
    </Stack>
  );
}

function DeviceRegistrationPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);
  const [searchParams] = useSearchParams();

  // The Logs page links here with ?uniqueId=<IMEI> for a tracker that tried to
  // connect before being registered — skip straight to Confirm in that case.
  const prefilledImei = extractImei(searchParams.get('uniqueId'));

  const [step, setStep] = useState(prefilledImei ? 2 : 0);
  const [method, setMethod] = useState(prefilledImei ? 'manual' : null);
  const [imei, setImei] = useState(prefilledImei);
  const [name, setName] = useState(prefilledImei ? `GPS Tracker - ${prefilledImei.slice(-6)}` : '');
  const [registered, setRegistered] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const validImei = /^\d{15}$/.test(imei);

  const handleDetected = useCallback((value) => {
    setImei(value);
    setMethod('scan');
    setError('');
    setStep(2);
  }, []);

  const handleMethod = (value) => {
    setMethod(value);
    setError('');
    setStep(1);
  };

  const handleContinueImei = () => {
    if (!validImei) {
      setError('Enter the 15-digit IMEI printed on the GPS tracker.');
      return;
    }

    setName((current) => current || `GPS Tracker - ${imei.slice(-6)}`);
    setError('');
    setStep(2);
  };

  const handleRegister = async () => {
    if (!validImei || !name.trim()) {
      setError('Please provide a valid 15-digit IMEI and tracker name.');
      return;
    }

    setSubmitting(true);
    setError('');
    setStep(3);

    try {
      const response = await fetchOrThrow('/api/fleet/devices', {
        method: 'POST',
        headers: {
          ...fuelApiAuthHeaders(user),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          uniqueId: imei,
        }),
      });

      const device = await response.json();
      dispatch(devicesActions.update([device]));
      setRegistered({ name: name.trim(), imei });
    } catch (registrationError) {
      setSubmitting(false);
      setError(getRegistrationError(registrationError));
      setStep(2);
      return;
    }

    setSubmitting(false);
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/settings/devices')}
            sx={{ mb: 2 }}
          >
            Back to devices
          </Button>
          <Typography variant="h4" fontWeight={700}>Register GPS Tracker</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Add a GPS tracker to NUMZFLEET using its IMEI.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 }, borderRadius: 3 }}>
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
            {registrationSteps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {step === 0 && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h5" fontWeight={650}>
                  How would you like to add the tracker?
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Scan the IMEI from the tracker, or enter it manually.
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    cursor: 'pointer',
                    borderRadius: 2,
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                  onClick={() => handleMethod('scan')}
                >
                  <Stack spacing={1.5}>
                    <CameraAltIcon color="primary" sx={{ fontSize: 40 }} />
                    <Typography variant="h6" fontWeight={650}>Scan IMEI</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Use your camera to scan the barcode or QR code on the GPS tracker.
                    </Typography>
                    <Button variant="contained">Start scanning</Button>
                  </Stack>
                </Paper>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    cursor: 'pointer',
                    borderRadius: 2,
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                  onClick={() => handleMethod('manual')}
                >
                  <Stack spacing={1.5}>
                    <KeyboardIcon color="primary" sx={{ fontSize: 40 }} />
                    <Typography variant="h6" fontWeight={650}>
                      Enter IMEI manually
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Type the 15-digit IMEI printed on the GPS tracker.
                    </Typography>
                    <Button variant="outlined">Enter manually</Button>
                  </Stack>
                </Paper>
              </Box>
            </Stack>
          )}

          {step === 1 && method === 'scan' && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h5" fontWeight={650}>Scan IMEI</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Place the tracker barcode or QR code inside the frame.
                </Typography>
              </Box>
              <BarcodeScanner
                onDetected={handleDetected}
                onCancel={() => setMethod('manual')}
              />
            </Stack>
          )}

          {step === 1 && method === 'manual' && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h5" fontWeight={650}>Enter IMEI</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  The IMEI is normally a 15-digit number printed on the tracker label.
                </Typography>
              </Box>
              <TextField
                autoFocus
                fullWidth
                label="IMEI"
                value={imei}
                onChange={(event) => setImei(normaliseImei(event.target.value))}
                inputProps={{ inputMode: 'numeric', maxLength: 15 }}
                error={Boolean(imei) && !validImei}
                helperText={imei && !validImei ? 'Enter exactly 15 digits.' : ' '}
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Stack direction="row" justifyContent="space-between">
                <Button onClick={() => setStep(0)}>Back</Button>
                <Button variant="contained" onClick={handleContinueImei} disabled={!validImei}>
                  Continue
                </Button>
              </Stack>
            </Stack>
          )}

          {step === 2 && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h5" fontWeight={650}>Confirm GPS tracker</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Check the IMEI before registering the tracker.
                </Typography>
              </Box>

              {error && <Alert severity="error">{error}</Alert>}

              <Alert severity="info">
                Check that this matches the IMEI printed on your tracker, then register it.
              </Alert>

              <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary">IMEI</Typography>
                <Typography fontWeight={650}>{imei}</Typography>
              </Box>

              <TextField
                fullWidth
                label="Tracker name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                helperText="Give this tracker a name you will recognise."
              />

              <Stack direction="row" justifyContent="space-between">
                <Button onClick={() => setStep(0)}>Start over</Button>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<LinkIcon />}
                  onClick={handleRegister}
                  disabled={submitting || !validImei || !name.trim()}
                >
                  Register GPS tracker
                </Button>
              </Stack>
            </Stack>
          )}

          {step === 3 && submitting && (
            <Stack spacing={3} alignItems="center" sx={{ py: 5, textAlign: 'center' }}>
              <CircularProgress size={44} />
              <Box>
                <Typography variant="h5" fontWeight={650}>
                  Registering GPS tracker
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  Creating the tracker in NUMZFLEET and preparing it for tracking.
                </Typography>
              </Box>
            </Stack>
          )}

          {step === 3 && !submitting && !error && (
            <Stack spacing={3} alignItems="center" sx={{ py: 5, textAlign: 'center' }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 72 }} />
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  GPS tracker registered
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  The tracker is registered in NUMZFLEET. Next, assign it to a vehicle:
                  open Vehicles, choose the vehicle and select Assign tracker.
                </Typography>
              </Box>
              {registered && (
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', width: '100%', maxWidth: 360 }}>
                  <Typography variant="caption" color="text.secondary">Tracker</Typography>
                  <Typography fontWeight={650}>{registered.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    IMEI {registered.imei}
                  </Typography>
                </Box>
              )}
              <Divider flexItem />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <Button variant="contained" onClick={() => navigate('/fleet/vehicles')}>
                  Go to Vehicles to assign
                </Button>
                <Button variant="outlined" onClick={() => navigate('/settings/devices')}>
                  Back to devices
                </Button>
                <Button
                  onClick={() => {
                    setStep(0);
                    setMethod(null);
                    setImei('');
                    setName('');
                    setRegistered(null);
                  }}
                >
                  Register another tracker
                </Button>
              </Stack>
            </Stack>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}

const getUpdateError = (error) => {
  if (error?.status === 403) return 'You do not have permission to edit this tracker.';
  if (error?.status === 404) return 'This tracker is no longer in your fleet.';
  if (error?.status === 400) return 'Please check the details and try again.';
  return 'We could not save your changes. Please try again.';
};

/**
 * Edit a tracker. Only what a fleet manager owns can change here — name, SIM phone,
 * model and map icon. The IMEI is the tracker's identity and is shown read-only.
 * Loading and saving both go through fuel-api, scoped to the caller's company.
 */
const DeviceEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();
  const user = useSelector((state) => state.session.user);

  const [device, setDevice] = useState(null);
  const [form, setForm] = useState({
    name: '', phone: '', model: '', category: 'default',
  });
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await fetchFleetDeviceSnapshot(user);
        if (cancelled) return;
        const found = (snapshot?.devices || []).find((item) => String(item.id) === String(id));
        if (!found) {
          setLoadError('This tracker was not found in your fleet.');
          return;
        }
        setDevice(found);
        setForm({
          name: found.name || '',
          phone: found.phone || '',
          model: found.model || '',
          category: found.category || 'default',
        });
      } catch {
        if (!cancelled) setLoadError('We could not load this tracker. Please try again.');
      }
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  const dirty = Boolean(device) && (
    form.name !== (device.name || '')
    || form.phone !== (device.phone || '')
    || form.model !== (device.model || '')
    || form.category !== (device.category || 'default')
  );
  const valid = form.name.trim().length > 0;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await updateFleetDevice(user, id, form);
      dispatch(devicesActions.update([updated]));
      navigate('/settings/devices');
    } catch (saveError) {
      setError(getUpdateError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/settings/devices')} sx={{ mb: 2 }}>
            Back to devices
          </Button>
          <Typography variant="h4" fontWeight={700}>Edit tracker</Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 }, borderRadius: 3 }}>
          {loadError && <Alert severity="error">{loadError}</Alert>}
          {!loadError && !device && (
            <Stack alignItems="center" sx={{ py: 5 }}><CircularProgress size={32} /></Stack>
          )}
          {device && (
            <Stack spacing={2.5}>
              <TextField
                label="IMEI"
                value={device.uniqueId || ''}
                disabled
                helperText="The tracker's identifier can't be changed."
                fullWidth
              />
              <TextField
                label={t('sharedName')}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                error={!valid}
                helperText={valid ? ' ' : 'A name is required.'}
                fullWidth
              />
              <TextField
                label={t('sharedPhone')}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                helperText="The SIM card number inside the tracker."
                fullWidth
              />
              <TextField
                label={t('deviceModel')}
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                fullWidth
              />
              <SelectField
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                data={deviceCategories.map((category) => ({
                  id: category,
                  name: t(`category${category.replace(/^\w/, (c) => c.toUpperCase())}`),
                })).sort((a, b) => a.name.localeCompare(b.name))}
                label="Map icon"
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Stack direction="row" justifyContent="space-between">
                <Button onClick={() => navigate('/settings/devices')}>Cancel</Button>
                <Button variant="contained" onClick={handleSave} disabled={saving || !valid || !dirty}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </Stack>
            </Stack>
          )}
        </Paper>
      </Stack>
    </Container>
  );
};

const DevicePage = () => {
  const { id } = useParams();
  return id ? <DeviceEditPage /> : <DeviceRegistrationPage />;
};

export default DevicePage;
