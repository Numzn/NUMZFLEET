import { lightTokens } from './designTokens';

const { colors: c, radius } = lightTokens;

export default {
  MuiUseMediaQuery: {
    defaultProps: {
      noSsr: true,
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        borderRadius: `${radius.md}px`,
        boxShadow: 'none',
        border: '1px solid var(--surface-border)',
        backgroundColor: 'var(--surface-card)',
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: `${radius.md}px`,
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '13px',
        lineHeight: 1.3,
        padding: '8px 16px',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        boxShadow: 'none',
        '&:hover': {
          boxShadow: 'none',
          transform: 'none',
        },
      },
      sizeMedium: {
        height: '40px',
      },
      contained: {
        boxShadow: 'none',
        '&:hover': {
          boxShadow: 'none',
        },
      },
      outlined: {
        borderWidth: '1px',
        '&:hover': {
          borderWidth: '1px',
        },
      },
    },
    variants: [
      {
        props: { variant: 'approve' },
        style: {
          backgroundColor: c.success,
          color: '#FFFFFF',
          '&:hover': {
            backgroundColor: c.success,
            filter: 'brightness(0.95)',
          },
        },
      },
      {
        props: { variant: 'reject' },
        style: {
          backgroundColor: c.critical,
          color: '#FFFFFF',
          '&:hover': {
            backgroundColor: c.critical,
            filter: 'brightness(0.95)',
          },
        },
      },
    ],
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: `${radius.md}px`,
        boxShadow: 'none',
        border: '1px solid var(--surface-border)',
        backgroundColor: 'var(--surface-card)',
        backgroundImage: 'none',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        '&:hover': {
          borderColor: 'var(--color-border-hover)',
          backgroundColor: 'var(--surface-card-hover)',
        },
      },
    },
    variants: [
      {
        props: { variant: 'priority' },
        style: {
          border: `2px solid ${c.primary}`,
        },
      },
      {
        props: { variant: 'alert' },
        style: {
          borderLeft: `4px solid ${c.critical}`,
        },
      },
      {
        props: { variant: 'hover' },
        style: {
          '&:hover': {
            borderColor: 'var(--color-border-hover)',
          },
        },
      },
    ],
  },
  MuiChip: {
    styleOverrides: {
      root: {
        fontWeight: 500,
        fontSize: '12px',
        borderRadius: `${radius.sm}px`,
      },
    },
    variants: [
      {
        props: { variant: 'live' },
        style: {
          backgroundColor: 'var(--color-success-light)',
          color: 'var(--color-success)',
        },
      },
      {
        props: { variant: 'offline' },
        style: {
          backgroundColor: 'var(--surface-workspace)',
          color: 'var(--color-text-secondary)',
        },
      },
      {
        props: { variant: 'warning' },
        style: {
          backgroundColor: 'var(--color-warning-light)',
          color: 'var(--color-warning)',
        },
      },
      {
        props: { variant: 'critical' },
        style: {
          backgroundColor: 'var(--color-critical-light)',
          color: 'var(--color-critical)',
        },
      },
    ],
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: '1px solid var(--surface-border)',
        fontSize: '14px',
        padding: '12px 16px',
        color: 'var(--color-text-primary)',
      },
      head: {
        backgroundColor: 'var(--surface-workspace)',
        color: 'var(--color-text-secondary)',
        fontSize: '13px',
        fontWeight: 500,
        borderBottom: '1px solid var(--surface-border)',
      },
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: {
        height: '56px',
        backgroundColor: 'var(--surface-card)',
        '&:hover': {
          backgroundColor: 'var(--surface-card-hover)',
        },
        '&:last-child td': {
          borderBottom: 'none',
        },
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: `${radius.md}px`,
          backgroundColor: 'var(--surface-card)',
          '& fieldset': {
            borderColor: 'var(--surface-border)',
          },
          '&:hover fieldset': {
            borderColor: 'var(--color-border-hover)',
          },
          '&.Mui-focused fieldset': {
            borderColor: 'var(--color-primary)',
          },
        },
      },
    },
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: {
        height: 6,
        borderRadius: `${radius.sm}px`,
        backgroundColor: 'var(--surface-elevated)',
      },
      bar: {
        borderRadius: `${radius.sm}px`,
      },
    },
  },
  MuiFormControl: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiSnackbar: {
    defaultProps: {
      anchorOrigin: {
        vertical: 'bottom',
        horizontal: 'center',
      },
    },
  },
  MuiTooltip: {
    defaultProps: {
      enterDelay: 500,
      enterNextDelay: 500,
    },
  },
};
