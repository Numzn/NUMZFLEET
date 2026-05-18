import { grey } from '@mui/material/colors';
import { lightTokens } from './designTokens';
import { darkSurfaces, lightSurfaces } from './surfaceTokens';

const { colors: c } = lightTokens;

export default (server, darkMode) => {
  if (darkMode) {
    return {
      mode: 'dark',
      background: {
        default: darkSurfaces.app,
        paper: darkSurfaces.card,
      },
      primary: {
        main: c.primary,
        light: '#60A5FA',
        dark: c.primaryDark,
      },
      secondary: {
        main: c.info,
        light: '#38BDF8',
        dark: c.primaryDark,
      },
      text: {
        primary: darkSurfaces.textOnSurface,
        secondary: darkSurfaces.textMutedOnSurface,
        disabled: '#64748B',
      },
      success: {
        main: c.success,
        light: '#34D399',
      },
      warning: {
        main: c.warning,
        light: '#FBBF24',
      },
      error: {
        main: c.critical,
        light: '#F87171',
      },
      divider: darkSurfaces.border,
      neutral: {
        main: grey[500],
      },
      geometry: {
        main: c.primary,
      },
      alwaysDark: {
        main: darkSurfaces.elevated,
      },
    };
  }

  return {
    mode: 'light',
    background: {
      default: lightSurfaces.app,
      paper: lightSurfaces.card,
    },
    primary: {
      main: c.primary,
      light: c.primaryLight,
      dark: c.primaryDark,
    },
    secondary: {
      main: c.info,
      light: c.infoLight,
      dark: c.primaryDark,
    },
    text: {
      primary: lightSurfaces.textOnSurface,
      secondary: lightSurfaces.textMutedOnSurface,
      disabled: c.textDisabled,
    },
    success: {
      main: c.success,
      light: c.successLight,
    },
    warning: {
      main: c.warning,
      light: c.warningLight,
    },
    error: {
      main: c.critical,
      light: c.criticalLight,
    },
    divider: lightSurfaces.border,
    neutral: {
      main: grey[500],
    },
    geometry: {
      main: c.primary,
    },
    alwaysDark: {
      main: lightSurfaces.textOnSurface,
    },
  };
};
