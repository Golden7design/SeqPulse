/**
 * Custom Verdict Icons for SeqPulse
 * Semantic meaning through visual language + animation
 */

interface VerdictIconProps {
  className?: string
  size?: number
  animated?: boolean
}

/**
 * OK Icon — Flow Confidence
 * Two checkmarks forming a subtle flow pattern
 * Signals "you're good to keep going"
 */
export function VerdictIconOK({ className = "", size = 24, animated = true }: VerdictIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {animated && (
          <linearGradient id="ok-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.8">
              <animate attributeName="stopOpacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
          </linearGradient>
        )}
      </defs>
      {/* Primary checkmark */}
      <path
        d="M4 12 L9 17 L20 5"
        stroke="url(#ok-gradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {animated && (
          <animate
            attributeName="stroke-dasharray"
            from="0,100"
            to="100,0"
            dur="0.6s"
            fill="freeze"
          />
        )}
      </path>
      {/* Secondary subtle checkmark (flow) */}
      <path
        d="M4 17 L6 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  )
}

/**
 * Warning Icon — Caution, Not Panic
 * Exclamation mark in a subtle circle
 * Signals "check this when convenient"
 */
export function VerdictIconWarning({ className = "", size = 24, animated = true }: VerdictIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g>
        {/* Circle background (subtle) */}
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="currentColor"
          fillOpacity="0.1"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.7"
        >
          {animated && (
            <animate
              attributeName="r"
              values="9;10;9"
              dur="2s"
              repeatCount="indefinite"
            />
          )}
        </circle>
        {/* Exclamation mark */}
        <path
          d="M12 7 V14"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          {animated && (
            <animate
              attributeName="stroke-dasharray"
              from="0,100"
              to="100,0"
              dur="0.4s"
              fill="freeze"
            />
          )}
        </path>
        <circle cx="12" cy="17" r="1.5" fill="currentColor" opacity="0.9" />
      </g>
    </svg>
  )
}

/**
 * Rollback Icon — Action Required
 * Arrow back with pause symbol
 * Signals "this needs attention now"
 */
export function VerdictIconRollback({ className = "", size = 24, animated = true }: VerdictIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {animated && (
          <linearGradient id="rollback-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.7">
              <animate attributeName="stopOpacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        )}
      </defs>
      {/* Circular arrow (rollback) */}
      <path
        d="M17 17L13 13H17V10L22 15L17 20V17Z"
        fill="currentColor"
        fillOpacity="0.8"
      />
      <path
        d="M7 7L11 11H7V14L2 9L7 4V7Z"
        stroke="url(#rollback-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-1; 0,0"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </path>
      {/* Pause bars (stop action) */}
      <path
        d="M8 4V10M16 4V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  )
}

/**
 * Live Running Icon — Deployment in progress
 * Pulse ring with activity indicator
 */
export function LiveRunningIcon({ className = "", size = 20 }: VerdictIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer pulse ring */}
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
      >
        <animate
          attributeName="r"
          values="8;12;8"
          dur="1.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.4;0;0.4"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
      {/* Inner activity ring */}
      <circle
        cx="12"
        cy="12"
        r="5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        opacity="0.7"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="30"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      {/* Core dot */}
      <circle cx="12" cy="12" r="2" fill="currentColor">
        <animate
          attributeName="opacity"
          values="1;0.6;1"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  )
}

/**
 * Live Finished Icon — Deployment completed
 * Checkmark with subtle completion ring
 */
export function LiveFinishedIcon({ className = "", size = 20 }: VerdictIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Completion ring */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      />
      {/* Checkmark */}
      <path
        d="M8 12 L11 15 L16 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

/**
 * Compact Verdict Badge — For inline use
 */
export function CompactVerdictBadge({ type, size = 16 }: { type: 'ok' | 'warning' | 'rollback', size?: number }) {
  const Icon = {
    ok: VerdictIconOK,
    warning: VerdictIconWarning,
    rollback: VerdictIconRollback,
  }[type]

  return <Icon size={size} animated={true} className="opacity-70" />
}