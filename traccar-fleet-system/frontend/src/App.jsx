import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { traccarPath, traccarFetch } from './config/traccarApi.js';

import { useDispatch, useSelector } from 'react-redux';
import { useMediaQuery, useTheme } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SocketController from './SocketController';
import FuelSocketController from './fuelRequests/socket/FuelSocketController';
import CachingController from './CachingController';
import { useCatch, useEffectAsync } from './reactHelper';
import { sessionActions } from './store';
import UpdateController from './UpdateController';
import TermsDialog from './common/components/TermsDialog';
import Loader from './common/components/Loader';
import fetchOrThrow from './common/util/fetchOrThrow';
import PWAInstallPrompt from './components/PWAInstallPrompt';

const useStyles = makeStyles()(() => ({
  page: {
    flexGrow: 1,
    overflow: 'auto',
  },
}));

const App = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const newServer = useSelector((state) => state.session.server.newServer);
  const termsUrl = useSelector((state) => state.session.server.attributes.termsUrl);
  const user = useSelector((state) => state.session.user);

  const acceptTerms = useCatch(async () => {
    const response = await fetchOrThrow(traccarPath(`/api/users/${user.id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, attributes: { ...user.attributes, termsAccepted: true } }),
    });
    dispatch(sessionActions.updateUser(await response.json()));
  });

  useEffectAsync(async () => {
    if (!user) {
      const response = await traccarFetch('/api/session');
      if (response.ok) {
        dispatch(sessionActions.updateUser(await response.json()));

        try {
          const fuelProbe = await fetch('/api/fuel-requests', { credentials: 'include' });
          if (fuelProbe.status === 401) {
            await traccarFetch('/api/session', { method: 'DELETE' });
            window.sessionStorage.setItem('postLogin', pathname + search);
            navigate(newServer ? '/register' : '/login', { replace: true });
          }
        } catch {
          // Ignore probe failures (network, server issues). This check is only to detect stale cookies.
        }
      } else {
        window.sessionStorage.setItem('postLogin', pathname + search);
        navigate(newServer ? '/register' : '/login', { replace: true });
      }
    }
    return null;
  }, []);

  if (user == null) {
    return (<Loader />);
  }
  if (termsUrl && !user.attributes.termsAccepted) {
    return (
      <TermsDialog
        open
        onCancel={() => navigate('/login')}
        onAccept={() => acceptTerms()}
      />
    );
  }
  return (
    <>
      <SocketController />
      <FuelSocketController />
      <CachingController />
      <UpdateController />
      <PWAInstallPrompt />
      <div className={classes.page}>
        <Outlet />
      </div>
    </>
  );
};

export default App;
