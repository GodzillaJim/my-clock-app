/**
 * Design tokens: the single source of the app's colours, type, radii, shadows
 * and motion. The MUI theme is generated from these (buildAppTheme.ts), and the
 * active colour scheme is also published as CSS custom properties for code that
 * lives outside React's theme (cssVariables below).
 *
 * One style in light and dark (PRODUCT.md; design brief on #59): warm-tinted
 * neutrals, a terracotta accent for focus and a quieter sage for breaks.
 * Colours are chosen in OKLCH (in the comments) and stored as hex, because
 * MUI's colour helpers cannot parse OKLCH. Every text pairing meets WCAG AA,
 * and the ring, input outlines and status colours meet 3:1.
 *
 * Primitive values appear only in this file. Components refer to semantic
 * roles: `theme.tokens.surface.panel`, `palette.primary.main`, or `var(--fs-…)`.
 */

export interface ColorScheme {
  mode: 'light' | 'dark';
  /** Focus: the one accent, for the primary action and a running focus session. */
  primary: { main: string; dark: string; light: string; contrastText: string };
  /** Breaks: the quieter second hue. */
  secondary: { main: string; dark: string; light: string; contrastText: string };
  success: string;
  error: string;
  warning: string;
  text: { primary: string; secondary: string; muted: string };
  surface: {
    /** The window background. */
    page: string;
    /** Default surface for cards and panels inside a view. */
    card: string;
    /** MUI Paper. */
    paper: string;
    /** Dialogs, drawers, toasts and other surfaces above the page. */
    raised: string;
    /** Navigation and tool bars (sidebar, control bar): the second neutral layer. */
    panel: string;
    /** A quieter panel beside the main content. */
    panelMuted: string;
    /** Subtle fill for items inside a panel. */
    inset: string;
  };
  line: {
    /** Separators between rows. */
    subtle: string;
    /** Borders of cards and panels. */
    default: string;
    /** Hover borders. */
    hover: string;
    /** Input outlines and selected items (3:1 against surfaces). */
    strong: string;
    /** Borders of raised surfaces. */
    raised: string;
    /** MUI's divider. */
    divider: string;
  };
  overlay: {
    /** Hover and selected fills on icon buttons and nav items. */
    hover: string;
    /** Progress tracks and empty indicators. */
    track: string;
  };
  /** Outlined button borders. */
  outlinedButton: { border: string; hoverBorder: string; hoverFill: string };
  shadow: { card: string; raised: string; toast: string };
  scrollbar: { track: string; thumb: string; thumbHover: string };
  focusRing: string;
}

// Each hex value's OKLCH source (L C h) is in the comment beside it.

const light: ColorScheme = {
  mode: 'light',
  primary: {
    main: '#B25634', // terracotta 0.56 0.13 40
    dark: '#9E4421', // 0.50 0.13 40
    light: '#D28A69', // 0.70 0.10 45
    contrastText: '#FEFBF8', // 0.99 0.005 75
  },
  secondary: {
    main: '#4D7455', // sage 0.52 0.065 150
    dark: '#3C6245', // 0.46 0.065 150
    light: '#7EA385', // 0.68 0.06 150
    contrastText: '#FEFBF8',
  },
  success: '#2A7449', // 0.50 0.10 155
  error: '#B6322B', // brick 0.52 0.17 28
  warning: '#906106', // ochre 0.53 0.11 75
  text: {
    primary: '#2B2521', // ink 0.27 0.012 60
    secondary: '#635C57', // 0.48 0.012 60
    muted: '#857F7A', // 0.60 0.01 65
  },
  surface: {
    page: '#FAF6F1', // paper 0.975 0.008 75
    card: '#FFFDFA', // 0.995 0.004 75
    paper: '#FFFDFA',
    raised: '#FFFDFA',
    panel: '#F4EFEA', // 0.955 0.008 70
    panelMuted: '#F7F2ED', // 0.965 0.008 70
    inset: '#F3EFEB', // 0.955 0.007 75
  },
  line: {
    subtle: '#EBE7E2', // 0.93 0.008 70
    default: '#E1DBD5', // 0.895 0.01 70
    hover: '#D3CDC6', // 0.85 0.012 70
    strong: '#8F8880', // 0.63 0.014 70
    raised: '#E1DBD5',
    divider: '#E1DBD5',
  },
  overlay: {
    hover: 'rgba(43, 37, 33, 0.06)', // ink at 6%
    track: '#E9E4DE', // 0.92 0.01 70
  },
  outlinedButton: {
    border: '#D3CDC6',
    hoverBorder: '#8F8880',
    hoverFill: 'rgba(43, 37, 33, 0.04)',
  },
  shadow: {
    card: '0 1px 2px rgba(43, 37, 33, 0.05)',
    raised: '0 2px 6px rgba(43, 37, 33, 0.06), 0 12px 32px rgba(43, 37, 33, 0.10)',
    toast: '0 2px 6px rgba(43, 37, 33, 0.06), 0 12px 32px rgba(43, 37, 33, 0.12)',
  },
  scrollbar: {
    track: 'transparent',
    thumb: '#C3BDB6', // 0.80 0.012 70
    thumbHover: '#A39D97', // 0.70 0.012 70
  },
  focusRing: '#B25634',
};

const dark: ColorScheme = {
  mode: 'dark',
  primary: {
    main: '#E28B63', // terracotta 0.72 0.12 45
    dark: '#D3754F', // 0.66 0.13 42
    light: '#E9AF90', // 0.80 0.08 50
    contrastText: '#1A1512', // 0.20 0.01 60
  },
  secondary: {
    main: '#97BC9D', // sage 0.76 0.06 150
    dark: '#7EA385', // 0.68 0.06 150
    light: '#B4D4BA', // 0.84 0.05 150
    contrastText: '#1A1512',
  },
  success: '#82C298', // 0.76 0.09 155
  error: '#EF7F72', // 0.72 0.14 28
  warning: '#E3B667', // 0.80 0.11 80
  text: {
    primary: '#ECE7E1', // ivory 0.93 0.01 75
    secondary: '#B6B0A9', // 0.76 0.012 70
    muted: '#8B8580', // 0.62 0.01 65
  },
  surface: {
    page: '#171310', // warm charcoal 0.19 0.008 60
    card: '#201C19', // 0.23 0.009 60
    paper: '#201C19',
    raised: '#25211D', // 0.25 0.01 60
    panel: '#1B1715', // 0.21 0.008 60
    panelMuted: '#191513', // 0.20 0.008 60
    inset: '#28231F', // 0.26 0.01 60
  },
  line: {
    subtle: '#272320', // 0.26 0.008 60
    default: '#322D29', // 0.30 0.01 60
    hover: '#3F3935', // 0.35 0.01 60
    strong: '#7A736E', // 0.56 0.012 60
    raised: '#3F3935',
    divider: '#322D29',
  },
  overlay: {
    hover: 'rgba(236, 231, 225, 0.06)', // ivory at 6%
    track: '#322D29',
  },
  outlinedButton: {
    border: '#3F3935',
    hoverBorder: '#7A736E',
    hoverFill: 'rgba(236, 231, 225, 0.04)',
  },
  shadow: {
    card: 'none',
    raised: '0 12px 40px rgba(0, 0, 0, 0.45)',
    toast: '0 12px 40px rgba(0, 0, 0, 0.5)',
  },
  scrollbar: {
    track: 'transparent',
    thumb: '#47413D', // 0.38 0.01 60
    thumbHover: '#625C58', // 0.48 0.01 60
  },
  focusRing: '#E28B63',
};

/** The colour scheme for light or dark. */
export function colorScheme(isDark: boolean): ColorScheme {
  return isDark ? dark : light;
}

/** Where no theme exists (the crash screen): follow the system setting. */
export function systemScheme(): ColorScheme {
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return colorScheme(prefersDark);
}

// ---------------------------------------------------------------------------
// Type, shape, motion
// ---------------------------------------------------------------------------

const textFamily = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
const displayFamily = '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';

export const typography = {
  /** The Windows system font: native, crisp, nothing to download. */
  fontFamily: textFamily,
  displayFamily,
  monoFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
  /** Clock digits: light and tabular, so the time never shifts as it counts. */
  timer: {
    fontFamily: displayFamily,
    fontWeight: 300,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  /** Small capitals for status labels ("Focus", "Break"). */
  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  /** Steps of about 1.2. */
  scale: {
    h1: { fontSize: '3.5rem', fontWeight: 300, lineHeight: 1.1, letterSpacing: '-0.02em' },
    h2: { fontSize: '2.5rem', fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.015em' },
    h3: { fontSize: '2rem', fontWeight: 500, lineHeight: 1.25 },
    h4: { fontSize: '1.625rem', fontWeight: 600, lineHeight: 1.3 },
    h5: { fontSize: '1.375rem', fontWeight: 600, lineHeight: 1.35 },
    h6: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: '1rem', lineHeight: 1.55 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '0' },
    caption: { fontSize: '0.75rem', lineHeight: 1.4 },
  },
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999, round: '50%' } as const;

export const motion = {
  /** Hover and state feedback. */
  fast: '150ms',
  /** Most transitions. */
  base: '200ms',
  /** Entering and leaving surfaces. */
  slow: '250ms',
  /** ease-out-quart */
  easeOut: 'cubic-bezier(0.25, 1, 0.5, 1)',
} as const;

/** The active scheme as CSS custom properties (`--fs-…`), set on :root by the app. */
export function cssVariables(scheme: ColorScheme): Record<string, string> {
  return {
    '--fs-page': scheme.surface.page,
    '--fs-raised': scheme.surface.raised,
    '--fs-text': scheme.text.primary,
    '--fs-text-secondary': scheme.text.secondary,
    '--fs-primary': scheme.primary.main,
    '--fs-line': scheme.line.default,
    '--fs-line-raised': scheme.line.raised,
    '--fs-shadow-toast': scheme.shadow.toast,
    '--fs-focus-ring': scheme.focusRing,
    '--fs-scrollbar-track': scheme.scrollbar.track,
    '--fs-scrollbar-thumb': scheme.scrollbar.thumb,
    '--fs-scrollbar-thumb-hover': scheme.scrollbar.thumbHover,
    '--fs-font': typography.fontFamily,
    '--fs-radius-md': `${radius.md}px`,
    '--fs-motion-fast': motion.fast,
    '--fs-motion-slow': motion.slow,
    '--fs-ease-out': motion.easeOut,
  };
}
