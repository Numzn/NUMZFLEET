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

// index.html paints a static .loader spinner so there is something on screen
// before this bundle even parses. Nothing hid it once React took over — it sat
// on top of the fully-rendered app on every fresh page load (HMR-preserved dev
// sessions never hit that path, which is why it went unnoticed).
//
// Hidden, NOT removed: common/components/Loader.jsx does not render its own
// spinner, it shows and hides this same element — and four components render
// <Loader /> (App, Navigation, ServerProvider, ChangeServerPage). Removing the
// node makes every one of them throw on mount, which takes down the whole app
// behind the ErrorBoundary.
const staticLoader = document.querySelector('.loader');
if (staticLoader) {
  staticLoader.style.display = 'none';
}
