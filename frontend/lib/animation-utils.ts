/**
 * Animation utilities for SeqPulse
 * Staggered animations, smooth state transitions, motion timing
 */

/**
 * Get stagger delay for grid items based on index
 * Creates cascading entry effect
 */
export function getStaggerDelay(
  index: number,
  baseDelay: number = 50,
  staggerMultiplier: number = 0.8
): string {
  const delay = index * baseDelay * staggerMultiplier
  return `${delay}ms`
}

/**
 * Animation timing presets
 */
export const animationTimings = {
  instant: '100ms',
  short: '200ms',
  default: '300ms',
  medium: '500ms',
  long: '750ms',
  pulse: '2000ms',
} as const

/**
 * Animation easing functions
 */
export const animationEasings = {
  easeOut: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  easeIn: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
  easeInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  bouncy: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const

/**
 * Get CSS transition string for props
 */
export function getTransition(
  properties: string[],
  duration: string = animationTimings.default,
  easing: string = animationEasings.easeOut
): string {
  const transition = properties.map(prop => `${prop} ${duration} ${easing}`).join(', ')
  return `${transition}, transform ${duration} ${easing}`
}

/**
 * Deployment state transition types
 */
export type DeploymentState = 'pending' | 'running' | 'finished' | 'analyzed'

/**
 * State transition configuration
 */
export const stateTransitions: Record<
  DeploymentState,
  {
    duration: string
    easing: string
    enterAnimation: string
    exitAnimation: string
  }
> = {
  pending: {
    duration: animationTimings.short,
    easing: animationEasings.easeIn,
    enterAnimation: 'fadeIn 200ms ease-in forwards',
    exitAnimation: 'fadeOut 150ms ease-out forwards',
  },
  running: {
    duration: animationTimings.medium,
    easing: animationEasings.easeInOut,
    enterAnimation: 'slideInRight 300ms ease-out forwards',
    exitAnimation: 'slideToLeftRight 200ms ease-in forwards',
  },
  finished: {
    duration: animationTimings.default,
    easing: animationEasings.easeOut,
    enterAnimation: 'fadeIn 200ms ease-out forwards',
    exitAnimation: 'scaleDown 150ms ease-in forwards',
  },
  analyzed: {
    duration: animationTimings.medium,
    easing: animationEasings.spring,
    enterAnimation: 'scaleUp 350ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
    exitAnimation: 'scaleDown 200ms ease-in forwards',
  },
} as const

/**
 * Get transition class for deployment state
 */
export function getDeploymentStateTransition(
  fromState: DeploymentState | null,
  toState: DeploymentState
): string {
  if (fromState === toState) return ''

  const transition = stateTransitions[toState]
  return transition.enterAnimation
}

/**
 * Grid stagger animation for cards
 */
export function getGridStaggerClasses(
  index: number,
  total: number,
  baseDelay: number = 50
): string {
  const delay = getStaggerDelay(index, baseDelay)

  return `
    opacity: 0;
    transform: translateY(16px);
    animation: slideInUp 300ms cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
    animation-delay: ${delay};
  `
}

/**
 * Verdict badge glow animation
 */
export function getVerdictBadgeGlow(verdict: 'ok' | 'warning' | 'rollback'): string {
  const durations = {
    ok: '2.5s',
    warning: '2s',
    rollback: '1.5s',
  }
  return `status-glow-${verdict} ${durations[verdict]} ease-in-out infinite`
}

/**
 * Create keyframe rule for custom animations
 */
export function createKeyframeRule(
  name: string,
  keyframes: Record<string, CSSStyleDeclaration>
): string {
  const keyframeStr = Object.entries(keyframes)
    .map(([percent, styles]) => {
      const styleStr = Object.entries(styles)
        .map(([prop, value]) => `${prop}: ${value}`)
        .join('; ')
      return `${percent} { ${styleStr} }`
    })
    .join('\n  ')

  return `@keyframes ${name} {
  ${keyframeStr}
}`
}

/**
 * Inject custom keyframes into document
 */
export function injectKeyframes(name: string, css: string): void {
  if (typeof document === 'undefined') return

  const existing = document.getElementById(`keyframe-${name}`)
  if (existing) return

  const style = document.createElement('style')
  style.id = `keyframe-${name}`
  style.textContent = css
  document.head.appendChild(style)
}

/**
 * Get reduced motion preference
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Get animation with reduced motion fallback
 */
export function getMotionSensitiveAnimation(
  normalAnimation: string,
  reducedAnimation?: string
): string {
  return prefersReducedMotion() ? (reducedAnimation || normalAnimation.replace(/ \d+ms/g, ' 0ms')) : normalAnimation
}

/**
 * Performance: Batch animation updates
 */
export function batchAnimationUpdates(
  elements: HTMLElement[],
  updater: (el: HTMLElement) => void
): void {
  if (prefersReducedMotion() || elements.length === 0) return

  // Request animation frame for smooth batched updates
  requestAnimationFrame(() => {
    elements.forEach(updater)
  })
}

/**
 * Get animation variant based on viewport width
 */
export function getResponsiveAnimation(
  mobile: string,
  tablet: string,
  desktop: string
): string {
  if (typeof window === 'undefined') return desktop

  const width = window.innerWidth
  if (width < 768) return mobile
  if (width < 1024) return tablet
  return desktop
}