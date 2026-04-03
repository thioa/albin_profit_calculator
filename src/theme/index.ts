/**
 * Design System - Albion Market Insight
 *
 * Centralized design tokens and configuration for consistent UI across all pages.
 * All colors, typography, spacing, and component styles are defined here.
 */

export const theme = {
  // ─── Colors ─────────────────────────────────────────────────────────────────
  colors: {
    // Primary palette
    primary: {
      DEFAULT: 'var(--color-primary)',      // #8aacff - Main accent
      dark: 'var(--color-on-primary)',      // #002b6b - Text on primary
      dim: 'var(--color-primary-dim)',       // #6f9bff - Dimmed primary
      fixed: 'var(--color-primary-fixed)',  // #749eff - Fixed primary
    },
    secondary: {
      DEFAULT: 'var(--color-secondary)',    // #72eff5 - Cyan accent
      dim: 'var(--color-secondary-dim)',     // #63e1e7 - Dimmed secondary
    },
    tertiary: {
      DEFAULT: 'var(--color-tertiary)',      // #a18eff - Purple accent
      dim: 'var(--color-tertiary-dim)',      // #765bee - Dimmed tertiary
    },

    // Surface colors (dark theme)
    surface: {
      DEFAULT: 'var(--color-surface)',       // #0a0e14 - Main background
      dim: 'var(--color-surface-dim)',       // #0a0e14 - Dimmed surface
      bright: 'var(--color-surface-bright)', // #262c36 - Bright surface
      container: 'var(--color-surface-container)',      // #151a21
      containerHigh: 'var(--color-surface-container-high)',    // #1b2028
      containerHighest: 'var(--color-surface-container-highest)', // #20262f
      containerLow: 'var(--color-surface-container-low)',      // #0f141a
      containerLowest: 'var(--color-surface-container-lowest)', // #000000
    },

    // Semantic colors
    success: {
      DEFAULT: '#22c55e',  // Green - profitable trades
      light: '#4ade80',
      dark: '#16a34a',
    },
    warning: {
      DEFAULT: '#f59e0b',  // Amber - warnings
      light: '#fbbf24',
      dark: '#d97706',
    },
    error: {
      DEFAULT: '#ef4444',  // Red - errors, losses
      light: '#f87171',
      dark: '#dc2626',
    },
    info: {
      DEFAULT: '#3b82f6',  // Blue - info, buy city
      light: '#60a5fa',
      dark: '#2563eb',
    },

    // Text colors
    text: {
      primary: 'var(--color-on-surface)',     // #f1f3fc - Primary text
      secondary: 'var(--color-on-surface-variant)', // #a8abb3 - Secondary text
      muted: '#72757d',                       // Outline/muted text
      disabled: '#52525b',                    // Disabled text (passes WCAG AA)
    },

    // Border colors
    border: {
      primary: 'rgba(138, 172, 255, 0.1)',
      primaryHover: 'rgba(138, 172, 255, 0.2)',
      primaryStrong: 'rgba(138, 172, 255, 0.3)',
      subtle: 'rgba(255, 255, 255, 0.05)',
      default: 'rgba(255, 255, 255, 0.08)',
    },

    // Glass effect
    glass: {
      bg: 'rgba(32, 38, 47, 0.6)',
      border: 'rgba(138, 172, 255, 0.1)',
    },
  },

  // ─── Typography ─────────────────────────────────────────────────────────────
  typography: {
    fontFamily: {
      headline: 'var(--font-headline)',  // Space Grotesk
      body: 'var(--font-body)',          // Manrope
      mono: 'var(--font-mono)',          // JetBrains Mono
    },
    fontSize: {
      // Minimum readable size is 12px (text-xs) for accessibility
      xs:   '0.75rem',   // 12px - Minimum readable (labels, metadata)
      sm:   '0.875rem',  // 14px - Small text (descriptions)
      base: '1rem',      // 16px - Body text
      lg:   '1.125rem',  // 18px - Large body
      xl:   '1.25rem',   // 20px - Section titles
      '2xl': '1.5rem',   // 24px - Page titles
      '3xl': '1.875rem', // 30px - Hero text
      '4xl': '2.25rem',  // 36px - Hero headings
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
    letterSpacing: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em',
    },
  },

  // ─── Spacing ────────────────────────────────────────────────────────────────
  spacing: {
    0: '0',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
  },

  // ─── Border Radius ──────────────────────────────────────────────────────────
  borderRadius: {
    sm: '0.25rem',   // 4px - Small elements
    DEFAULT: '0.5rem', // 8px - Buttons, inputs
    md: '0.75rem',   // 12px - Cards, panels
    lg: '1rem',      // 16px - Large cards
    xl: '1.5rem',    // 24px - Modals
    '2xl': '2rem',   // 32px - Hero sections
    full: '9999px',  // Pills, avatars
  },

  // ─── Shadows ───────────────────────────────────────────────────────────────
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    DEFAULT: '0 4px 6px rgba(0, 0, 0, 0.4)',
    md: '0 6px 12px rgba(0, 0, 0, 0.5)',
    lg: '0 10px 20px rgba(0, 0, 0, 0.6)',
    xl: '0 20px 40px rgba(0, 0, 0, 0.7)',
    glow: {
      primary: '0 0 20px rgba(138, 172, 255, 0.15)',
      success: '0 0 20px rgba(34, 197, 94, 0.15)',
      error: '0 0 20px rgba(239, 68, 68, 0.15)',
    },
  },

  // ─── Transitions ───────────────────────────────────────────────────────────
  transitions: {
    fast: '150ms ease',
    DEFAULT: '200ms ease',
    slow: '300ms ease',
    slower: '500ms ease',
  },

  // ─── Z-Index Scale ─────────────────────────────────────────────────────────
  zIndex: {
    dropdown: '40',
    modal: '50',
    toast: '60',
  },
} as const;

// ─── Component Variants ──────────────────────────────────────────────────────

export const buttonVariants = {
  primary: `
    bg-primary text-on-primary font-extrabold px-6 py-3 rounded-lg
    hover:brightness-110 active:scale-[0.98]
    shadow-[0_4px_12px_rgba(212,175,55,0.2)]
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface
  `,
  secondary: `
    glass-panel border border-primary/20 text-primary font-bold px-5 py-2.5 rounded-lg
    hover:border-primary/40 hover:text-white hover:bg-primary/5
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-primary/50
  `,
  ghost: `
    text-primary/60 hover:text-primary
    px-3 py-2 rounded-lg
    hover:bg-white/5
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-primary/30
  `,
  danger: `
    bg-error/10 text-error border border-error/20 font-bold px-5 py-2.5 rounded-lg
    hover:bg-error/20 hover:border-error/40
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-error/50
  `,
  success: `
    bg-success/10 text-success border border-success/20 font-bold px-5 py-2.5 rounded-lg
    hover:bg-success/20 hover:border-success/40
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-success/50
  `,
  outline: `
    bg-transparent border border-primary/30 text-primary font-bold px-5 py-2.5 rounded-lg
    hover:border-primary/50 hover:bg-primary/5
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-primary/30
  `,
} as const;

export const cardVariants = {
  glass: `
    glass-panel border border-primary/10 rounded-xl p-5
    transition-all duration-300
  `,
  glassBordered: `
    glass-panel border border-primary/20 rounded-xl p-5
    transition-all duration-300 hover:border-primary/30
  `,
  solid: `
    bg-surface-container border border-white/5 rounded-xl p-5
    transition-all duration-300
  `,
  outlined: `
    bg-transparent border border-primary/10 rounded-xl p-5
    transition-all duration-300 hover:border-primary/20
  `,
  elevated: `
    bg-surface-container-high rounded-xl p-5
    border border-white/5 shadow-lg
    transition-all duration-300 hover:shadow-xl hover:bg-surface-container-highest
  `,
} as const;

export const inputVariants = {
  default: `
    w-full bg-black/40 border border-primary/10 rounded-lg py-3 px-4
    text-white text-sm font-medium placeholder:text-primary/30
    focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30
    transition-all duration-200
  `,
  search: `
    w-full glass-panel border border-primary/20 rounded-xl py-4 pl-12 pr-4
    text-white focus:outline-none focus:ring-2 focus:ring-primary
    transition-all duration-200
  `,
  compact: `
    w-full bg-black/20 border border-primary/20 rounded-lg py-2 px-3
    text-white text-sm font-bold text-center
    focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30
    transition-all duration-200
  `,
  ghost: `
    w-full bg-transparent border-none py-2 px-3
    text-white text-sm font-medium
    focus:outline-none
    transition-all duration-200
  `,
} as const;

export const badgeVariants = {
  default: `
    px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
    bg-primary/10 text-primary border border-primary/20
  `,
  success: `
    px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
    bg-success/10 text-success border border-success/20
  `,
  warning: `
    px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
    bg-warning/10 text-warning border border-warning/20
  `,
  error: `
    px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
    bg-error/10 text-error border border-error/20
  `,
  info: `
    px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
    bg-info/10 text-info border border-info/20
  `,
  subtle: `
    px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
    bg-white/5 text-primary/60 border border-white/5
  `,
} as const;

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Get status colors for freshness levels
 */
export const freshnessColors = {
  excellent: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  good: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20' },
  fair: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  stale: { bg: 'bg-error/10', text: 'text-error', border: 'border-error/20' },
} as const;

/**
 * Get status colors for verification
 */
export const verificationColors = {
  verified: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', dot: 'bg-success' },
  suspicious: { bg: 'bg-error/10', text: 'text-error', border: 'border-error/20', dot: 'bg-error' },
  unknown: { bg: 'bg-white/5', text: 'text-primary/50', border: 'border-white/5', dot: 'bg-primary/30' },
} as const;
