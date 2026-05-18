# Design token usage

## Source of truth

- **Brand / spacing / typography:** `designTokens.js`
- **Surfaces (mode-aware):** `surfaceTokens.js` + `globalCssVariables.css`
- **MUI theme:** `palette.js`, `components.js`, `index.js`

Keep JS surface values and CSS variables in sync when adding tokens.

## Surface hierarchy

| Token | Use for |
|-------|---------|
| `--surface-app` | Page canvas (`UnifiedShell` main, body-level bg) |
| `--surface-workspace` | Recessed areas, table headers, metric tile bg |
| `--surface-card` | Cards, tables, Paper, primary panels |
| `--surface-card-hover` | Row hover, card hover border context |
| `--surface-elevated` | Top bar, modals, fuel bar track (dark) |
| `--surface-border` | Card/table borders |

Legacy aliases `--color-surface` and `--color-surface-alt` map to `--surface-card` and `--surface-workspace`.

## When to use what

| Context | Use |
|---------|-----|
| MUI components in `sx` | `var(--surface-card)`, `theme.palette.background.default` (synced to surfaces) |
| Sidebar selected state, alert borders | `var(--surface-border)`, `var(--color-primary-light)` |
| Vehicle workspace legacy | `vehicleWorkspaceTokens.js` re-exports; prefer `var(--surface-*)` in new code |

## Mode switching

`AppThemeProvider` sets `data-theme="light"` or `data-theme="dark"` on `<html>`. CSS variables update automatically.

## Do not

- Hardcode `#FFFFFF` / `#F9FAFB` on fleet or vehicle pages
- Edit map vendor CSS for surface migration
