import { useMemo } from 'react';
import { createTheme } from '@mui/material/styles';
import palette from './palette';
import dimensions from './dimensions';
import components from './components';
import { lightTokens } from './designTokens';

const { typography: t } = lightTokens;

export default (server, darkMode, direction) => useMemo(() => createTheme({
  typography: {
    fontFamily: t.fontFamily,
    display: {
      ...t.display,
    },
    h1: {
      ...t.h1,
    },
    h2: {
      ...t.h2,
    },
    h3: {
      fontSize: '18px',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    body1: {
      ...t.body,
    },
    body2: {
      ...t.bodySmall,
    },
    caption: {
      ...t.caption,
    },
    button: {
      ...t.buttonLabel,
      textTransform: 'none',
    },
    metricValue: {
      ...t.metricValue,
    },
    metricSmall: {
      ...t.metricSmall,
    },
    kpi: {
      ...t.display,
    },
  },
  palette: palette(server, darkMode),
  direction,
  dimensions,
  components,
}), [server, darkMode, direction]);
