import './common/theme/globalCssVariables.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { CssBaseline, StyledEngineProvider } from '@mui/material';
import store from './store';
import { LocalizationProvider } from './common/components/LocalizationProvider';
import ErrorHandler from './common/components/ErrorHandler';
import Navigation from './Navigation';
import preloadImages from './map/core/preloadImages';
import NativeInterface from './common/components/NativeInterface';
import ServerProvider from './ServerProvider';
import ErrorBoundary from './ErrorBoundary';
import AppThemeProvider from './AppThemeProvider';
import ConnectivityProvider from './connectivity/ConnectivityProvider';
import ConnectivityBanner from './connectivity/ConnectivityBanner';

preloadImages();

const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <Provider store={store}>
      <LocalizationProvider>
        <StyledEngineProvider injectFirst>
          <AppThemeProvider>
            <CssBaseline />
            <ConnectivityProvider>
              <ServerProvider>
                <BrowserRouter>
                  <Navigation />
                  <ConnectivityBanner />
                </BrowserRouter>
                <ErrorHandler />
                <NativeInterface />
              </ServerProvider>
            </ConnectivityProvider>
          </AppThemeProvider>
        </StyledEngineProvider>
      </LocalizationProvider>
    </Provider>
  </ErrorBoundary>,
);

// index.html renders a static .loader spinner so there's something on
// screen before this bundle even parses. Nothing ever removed it once React
// took over — it sat on top of the fully-rendered app indefinitely on every
// fresh page load (HMR-preserved sessions never hit this, which is why it
// went unnoticed in normal day-to-day dev).
document.querySelector('.loader')?.remove();
