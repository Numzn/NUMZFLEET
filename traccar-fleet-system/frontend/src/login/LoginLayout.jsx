import { Paper, Box } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import LogoImage from './LogoImage';
import LoginInsights from './LoginInsights';
import FleetSummary from './FleetSummary';

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100svh',
    padding: theme.spacing(2),
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
    overflow: 'auto',
    backgroundColor: theme.palette.mode === 'dark' ? '#0b1220' : '#f1f5f9',
    backgroundImage:
      theme.palette.mode === 'dark'
        ? 'radial-gradient(900px 420px at 18% -8%, rgba(6, 182, 212, 0.14), transparent 58%), radial-gradient(700px 380px at 100% 12%, rgba(34, 211, 238, 0.06), transparent 55%), linear-gradient(168deg, #0b1220 0%, #0f172a 42%, #111827 100%)'
        : 'radial-gradient(900px 400px at 12% -6%, rgba(6, 182, 212, 0.12), transparent 55%), radial-gradient(640px 320px at 100% 0%, rgba(14, 165, 233, 0.06), transparent 50%), linear-gradient(168deg, #f8fafc 0%, #f1f5f9 55%, #e2e8f0 100%)',
  },
  topBar: {
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
    right: theme.spacing(2),
    zIndex: theme.zIndex.snackbar,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing(2.5),
    marginTop: theme.spacing(1),
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    padding: theme.spacing(0, 2),
  },
  paper: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: theme.spacing(52),
    marginBottom: theme.spacing(2),
    padding: theme.spacing(4, 3.5),
    borderRadius: theme.spacing(2),
    border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.07)'}`,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.78)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 24px 56px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)'
        : '0 22px 48px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}));

const LoginLayout = ({ topBar = null, children }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <main className={classes.root}>
      {topBar ? <div className={classes.topBar}>{topBar}</div> : null}
      <div className={classes.logoContainer}>
        <LogoImage color={theme.palette.primary.main} />
      </div>
      <LoginInsights />
        <FleetSummary />
      <Paper className={classes.paper} elevation={0} component={Box}>
        <form className={classes.form} noValidate>
          {children}
        </form>
      </Paper>
    </main>
  );
};

export default LoginLayout;
