/**
 * Design tokens: the single source of the app's colours, type, radii, shadows
 * and motion. The MUI theme is generated from these (buildAppTheme.ts), and the
 * active colour scheme is also published as CSS custom properties for code that
 * lives outside React's theme (cssVariables below).
 *
 * Primitive values appear only in this file. Components refer to semantic
 * roles: `theme.tokens.surface.panel`, `palette.primary.main`, or `var(--fs-…)`.
 */

export type VisualStyle = 'deepFocus' | 'aerogel';

export interface ColorScheme {
  mode: 'light' | 'dark';
  /** Accent roles; `secondary` marks breaks. */
  primary: { main: string; dark: string; light: string; contrastText: string };
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
    /** Dialogs, drawers and other surfaces above the page. */
    raised: string;
    /** Navigation and tool bars (sidebar, control bar). */
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
    /** Selected items and input outlines. */
    strong: string;
    /** Dialog borders. */
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
  /** Outlined button borders; omitted to keep MUI's default in light schemes. */
  outlinedButton?: { border: string; hoverBorder: string; hoverFill: string };
  shadow: { card: string; toast: string };
  scrollbar: { track: string; thumb: string; thumbHover: string };
  focusRing: string;
}

// ---------------------------------------------------------------------------
// Primitives (only referenced below)
// ---------------------------------------------------------------------------

const white = (a: number) => `rgba(255, 255, 255, ${a})`;
const black = (a: number) => `rgba(0, 0, 0, ${a})`;
const indigo = (a: number) => `rgba(99, 102, 241, ${a})`;

const blue = { 300: '#93C5FD', 400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB' };
const violet = { 300: '#C4B5FD', 400: '#A78BFA', 500: '#8B5CF6' };
const indigoHex = { 400: '#818CF8', 500: '#6366F1', 600: '#4F46E5' };
const pink = { 400: '#F472B6', 500: '#EC4899', 600: '#DB2777' };

/**
 * One scrollbar for every scheme: this is what has always rendered (the dark-theme rules
 * that tried to override it never applied). Revisiting it is part of the design pass (#59).
 */
const scrollbar = { track: 'transparent', thumb: '#CBD5E1', thumbHover: '#94A3B8' };

// ---------------------------------------------------------------------------
// Colour schemes
// ---------------------------------------------------------------------------

/** Deep Focus: dark only, high contrast, OLED-friendly. */
const deepFocus: ColorScheme = {
  mode: 'dark',
  primary: { main: blue[400], dark: blue[500], light: blue[300], contrastText: '#000000' },
  secondary: { main: violet[400], dark: violet[500], light: violet[300], contrastText: '#000000' },
  success: '#4ADE80',
  error: '#F87171',
  warning: '#FBBF24',
  text: { primary: '#F4F4F5', secondary: '#A1A1AA', muted: '#6B7280' },
  surface: {
    page: '#0A0A0C',
    card: 'rgba(24, 24, 28, 0.9)',
    paper: 'rgba(24, 24, 28, 0.95)',
    raised: 'rgba(18, 18, 22, 0.98)',
    panel: 'rgba(18, 18, 22, 0.95)',
    panelMuted: 'rgba(18, 18, 22, 0.6)',
    inset: white(0.03),
  },
  line: {
    subtle: white(0.05),
    default: white(0.08),
    hover: white(0.1),
    strong: white(0.15),
    raised: white(0.1),
    divider: white(0.08),
  },
  overlay: { hover: white(0.08), track: white(0.1) },
  outlinedButton: { border: white(0.2), hoverBorder: white(0.4), hoverFill: white(0.05) },
  shadow: { card: `0 4px 24px ${black(0.4)}`, toast: `0 8px 32px ${black(0.5)}` },
  scrollbar,
  focusRing: blue[600],
};

/** Aerogel, light: airy pastels on a soft white-blue page. */
const aerogelLight: ColorScheme = {
  mode: 'light',
  primary: {
    main: indigoHex[500],
    dark: indigoHex[600],
    light: indigoHex[400],
    contrastText: '#FFFFFF',
  },
  secondary: { main: pink[500], dark: pink[600], light: pink[400], contrastText: '#FFFFFF' },
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  text: { primary: '#1E293B', secondary: '#64748B', muted: '#94A3B8' },
  surface: {
    page: '#F8FAFC',
    card: white(0.7),
    paper: white(0.7),
    raised: white(0.95),
    panel: white(0.85),
    panelMuted: white(0.5),
    inset: indigo(0.04),
  },
  line: {
    subtle: indigo(0.06),
    default: indigo(0.1),
    hover: indigo(0.15),
    strong: indigo(0.2),
    raised: indigo(0.15),
    divider: indigo(0.15),
  },
  overlay: { hover: indigo(0.1), track: indigo(0.1) },
  shadow: { card: `0 4px 24px ${black(0.08)}`, toast: `0 8px 32px ${black(0.12)}` },
  scrollbar,
  focusRing: blue[600],
};

/** Aerogel, dark: the same accents on deep slate. */
const aerogelDark: ColorScheme = {
  ...aerogelLight,
  mode: 'dark',
  text: { primary: '#F1F5F9', secondary: '#94A3B8', muted: '#64748B' },
  surface: {
    page: '#0F172A',
    card: 'rgba(30, 41, 59, 0.8)',
    paper: 'rgba(30, 41, 59, 0.8)',
    raised: 'rgba(15, 23, 42, 0.95)',
    panel: 'rgba(15, 23, 42, 0.9)',
    panelMuted: 'rgba(15, 23, 42, 0.6)',
    inset: white(0.03),
  },
  line: {
    subtle: white(0.05),
    default: white(0.08),
    hover: white(0.1),
    strong: white(0.15),
    raised: white(0.1),
    divider: indigo(0.2),
  },
  overlay: { hover: white(0.08), track: white(0.1) },
  outlinedButton: { border: white(0.2), hoverBorder: white(0.4), hoverFill: white(0.05) },
  shadow: { card: `0 4px 24px ${black(0.4)}`, toast: `0 8px 32px ${black(0.5)}` },
  scrollbar,
};

/** The colour scheme for a visual style; Deep Focus is always dark. */
export function colorScheme(style: VisualStyle, dark: boolean): ColorScheme {
  if (style === 'deepFocus') return deepFocus;
  return dark ? aerogelDark : aerogelLight;
}

/** Used where no theme is available yet (the crash screen). */
export const defaultScheme = deepFocus;

// ---------------------------------------------------------------------------
// Type, shape, motion
// ---------------------------------------------------------------------------

export const typography = {
  fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  monoFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
  scale: {
    h1: { fontSize: '4rem', fontWeight: 300, lineHeight: 1.1, letterSpacing: '-0.025em' },
    h2: { fontSize: '2.5rem', fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.025em' },
    h3: { fontSize: '1.875rem', fontWeight: 500, lineHeight: 1.3 },
    h4: { fontSize: '1.5rem', fontWeight: 500, lineHeight: 1.4 },
    h5: { fontSize: '1.25rem', fontWeight: 500, lineHeight: 1.5 },
    h6: { fontSize: '1.125rem', fontWeight: 500, lineHeight: 1.5 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.01em' },
    caption: { fontSize: '0.75rem', lineHeight: 1.4 },
  },
} as const;

export const radius = { sm: 8, md: 12, lg: 16, round: '50%' } as const;

export const motion = {
  /** Hover and state feedback. */
  fast: '150ms',
  /** Most transitions. */
  base: '200ms',
  /** Entering and leaving surfaces. */
  slow: '300ms',
  easeOut: 'cubic-bezier(0.25, 1, 0.5, 1)',
  easeInOut: 'ease-in-out',
} as const;

export const blur = { panel: 'blur(12px)', raised: 'blur(20px)' } as const;

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
    '--fs-radius-md': `${radius.md}px`,
    '--fs-motion-slow': motion.slow,
    '--fs-ease-out': motion.easeOut,
  };
}
