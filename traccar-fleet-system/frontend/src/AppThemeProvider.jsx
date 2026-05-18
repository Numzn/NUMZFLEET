import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider, useMediaQuery } from '@mui/material';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import theme from './common/theme';
import { useLocalization } from './common/components/LocalizationProvider';

const cache = {
  ltr: createCache({
    key: 'muiltr',
    stylisPlugins: [prefixer],
  }),
  rtl: createCache({
    key: 'muirtl',
    stylisPlugins: [prefixer, rtlPlugin],
  }),
};

const AppThemeProvider = ({ children }) => {
  const server = useSelector((state) => state.session.server);
  const user = useSelector((state) => state.session.user);
  const { direction } = useLocalization();

  // Smart dark mode detection
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  
  // Priority: user preference > system preference > default to dark
  const darkMode = user?.attributes?.darkMode !== undefined 
    ? user.attributes.darkMode 
    : systemPrefersDark;

  const themeInstance = theme(server, darkMode, direction);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <CacheProvider value={cache[direction]}>
      <ThemeProvider theme={themeInstance}>
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
};

export default AppThemeProvider;
