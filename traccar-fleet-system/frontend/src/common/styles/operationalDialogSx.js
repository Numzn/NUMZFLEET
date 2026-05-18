/** Shared layout tokens for operational form dialogs (dark/light surface-aware). */

export const operationalDialogPaperProps = {
  sx: {
    borderRadius: 'var(--radius-lg)',
    bgcolor: 'var(--surface-elevated)',
    border: '1px solid var(--surface-border)',
    backgroundImage: 'none',
    boxShadow: 'var(--shadow-elevation)',
  },
};

export const operationalDialogTitleSx = {
  px: 3,
  pt: 2.5,
  pb: 0.5,
  fontWeight: 700,
  fontSize: '1.125rem',
  lineHeight: 1.3,
  color: 'var(--color-text-primary)',
};

export const operationalDialogContentSx = {
  px: 3,
  pt: 2.5,
  pb: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: 2.5,
};

export const operationalDialogActionsSx = {
  px: 3,
  py: 2,
  gap: 1,
};

/** Outlined field labels need a matching notch background on elevated dialogs. */
export const operationalDialogFieldSlotProps = {
  inputLabel: {
    sx: {
      color: 'var(--color-text-secondary)',
      '&.Mui-focused': {
        color: 'var(--color-primary)',
      },
      '&.MuiInputLabel-shrink': {
        bgcolor: 'var(--surface-elevated)',
        px: 0.75,
      },
    },
  },
};

export const operationalDialogPrimaryActionSx = {
  textTransform: 'none',
  fontWeight: 600,
  minWidth: 96,
  '&.Mui-disabled': {
    bgcolor: 'var(--surface-workspace)',
    color: 'var(--color-text-disabled)',
    opacity: 1,
  },
};
