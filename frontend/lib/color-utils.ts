/**
 * Color utilities for SeqPulse verdict system
 * Converts oklch values to CSS-compatible formats
 */

export const verdictColors = {
  ok: {
    light: 'oklch(0.65 0.14 150)',
    dark: 'oklch(0.72 0.15 150)',
    bg: 'oklch(0.65 0.14 150 / 0.1)',
    bgHover: 'oklch(0.65 0.14 150 / 0.15)',
    text: 'oklch(0.65 0.14 150)',
    glow: 'oklch(0.65 0.14 150 / 0.4)',
  },
  warning: {
    light: 'oklch(0.70 0.12 65)',
    dark: 'oklch(0.78 0.13 65)',
    bg: 'oklch(0.70 0.12 65 / 0.1)',
    bgHover: 'oklch(0.70 0.12 65 / 0.15)',
    text: 'oklch(0.70 0.12 65)',
    glow: 'oklch(0.70 0.12 65 / 0.4)',
  },
  rollback: {
    light: 'oklch(0.60 0.18 30)',
    dark: 'oklch(0.70 0.20 30)',
    bg: 'oklch(0.60 0.18 30 / 0.1)',
    bgHover: 'oklch(0.60 0.18 30 / 0.15)',
    text: 'oklch(0.60 0.18 30)',
    glow: 'oklch(0.60 0.18 30 / 0.4)',
  },
} as const

export type VerdictType = 'ok' | 'warning' | 'rollback'

export function getVerdictColor(verdict: VerdictType, type: keyof typeof verdictColors.ok = 'text'): string {
  const isDark = document.documentElement.classList.contains('dark')
  const colorSet = verdictColors[verdict]

  // For simple color values, use theme-aware
  if (type === 'text' || type === 'bg') {
    return isDark ? colorSet.dark : colorSet.light
  }

  return colorSet[type]
}

export function getVerdictGlowAnimation(verdict: VerdictType): string {
  const animations = {
    ok: 'status-glow-ok 2s ease-in-out infinite',
    warning: 'status-glow-warning 2s ease-in-out infinite',
    rollback: 'status-glow-rollback 2s ease-in-out infinite',
  }
  return animations[verdict]
}