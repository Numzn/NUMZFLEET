/**
 * Shared MUI `sx` spacing scale (theme spacing units) for runtime / operational surfaces.
 */

/** Vertical padding for workspace page blocks */
export const RUNTIME_CONTAINER_PY = 1.75;

/** Top inset on UnifiedShell main (replaces removed tab-strip chrome) */
export const RUNTIME_WORKSPACE_PT = { xs: 1.25, md: 1.5 };

/** Horizontal inset for UnifiedShell main — single source (pages should not add outer px) */
export const RUNTIME_WORKSPACE_PX = { xs: 2, md: 2.5 };

/** Primary Stack spacing between sections */
export const RUNTIME_STACK_GAP = 1.5;

/** Tighter stacks (lists, nested groups) */
export const RUNTIME_STACK_GAP_TIGHT = 1;
