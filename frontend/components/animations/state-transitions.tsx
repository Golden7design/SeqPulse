/**
 * Smooth state transition component
 * Handles automated state transitions with animations
 */

"use client"

import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

interface StateTransitionProps {
  fromState: string
  toState: string
  duration?: number
  onComplete?: () => void
  children: React.ReactNode
}

/**
 * Smooth state transition wrapper
 * Provides fade-scale-fade sequence for state changes
 */
export function StateTransition({
  fromState,
  toState,
  duration = 300,
  onComplete,
  children,
}: StateTransitionProps) {
  const shouldReduceMotion = useReducedMotion()
  const transitionDuration = shouldReduceMotion ? 0 : Math.max(duration, 100) / 1000

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={toState}
        initial={fromState === toState || shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
        transition={{
          duration: transitionDuration,
          ease: [0.22, 1, 0.36, 1],
        }}
        onAnimationComplete={() => {
          if (fromState !== toState) {
            onComplete?.()
          }
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
  duration?: number
}

/**
 * Route-level content transition.
 * Use this around page content containers (not around global chrome/sidebar).
 */
export function PageTransition({
  children,
  className,
  duration = 0.22,
}: PageTransitionProps) {
  const pathname = usePathname()
  const shouldReduceMotion = useReducedMotion()

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8, filter: "blur(2px)" }}
        transition={{
          duration: shouldReduceMotion ? 0 : duration,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={cn("min-h-0", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

interface ContentRevealProps {
  children: React.ReactNode
  className?: string
  duration?: number
}

/**
 * Use when swapping from skeleton -> real content.
 * Animates only on content mount, so the reveal happens after data is ready.
 */
export function ContentReveal({
  children,
  className,
  duration = 0.24,
}: ContentRevealProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : duration,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Live deployment indicator with smooth state transitions
 */
export function LiveDeploymentIndicator({
  state,
  label,
}: {
  state: "pending" | "running" | "finished" | "analyzed"
  label: string
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary dark:bg-primary/20 font-mono text-sm"
      >
        {(state === "pending" || state === "running") && (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
          />
        )}
        {state === "finished" && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-4 h-4 border-2 border-current rounded-full"
          />
        )}
        {state === "analyzed" && (
          <motion.svg
            initial={{ scale: 0, pathLength: 0 }}
            animate={{ scale: 1, pathLength: 1 }}
            transition={{
              scale: { duration: 0.2, type: "spring" },
              pathLength: { duration: 0.4, ease: "easeOut" },
            }}
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </motion.svg>
        )}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {label}
        </motion.span>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Verdict badge with smooth color transitions
 */
export function SmoothVerdictBadge({
  verdict,
  children,
}: {
  verdict: "ok" | "warning" | "rollback"
  children: React.ReactNode
}) {
  const colorMap = {
    ok: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
    warning: "bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400",
    rollback: "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  }

  return (
    <motion.div
      key={verdict}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
      }}
      whileHover={{ scale: 1.05 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-0 font-mono text-sm transition-all duration-300 ${colorMap[verdict]}`}
    >
      {children}
    </motion.div>
  )
}

/**
 * Loading overlay with smooth fade
 */
export function LoadingOverlay({
  show,
  message = "Loading...",
}: {
  show: boolean
  message?: string
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full"
            />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-sm text-muted-foreground"
            >
              {message}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Toast notification with enter/exit animations
 */
export function Toast({
  show,
  message,
  type = "info",
  onClose,
}: {
  show: boolean
  message: string
  type?: "info" | "success" | "warning" | "error"
  onClose?: () => void
}) {
  if (typeof document === "undefined") {
    return null
  }

  const typeColors = {
    info: "bg-blue-500",
    success: "bg-green-500",
    warning: "bg-orange-500",
    error: "bg-red-500",
  }

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ duration: 0.25, ease: [0.215, 0.61, 0.355, 1] }}
          className="fixed bottom-4 right-4 z-50"
        >
          <div className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg bg-card border ${typeColors[type]}/10 ${typeColors[type]}/20`}>
            <div className={`w-2 h-2 rounded-full ${typeColors[type]} mt-1.5 flex-shrink-0`} />
            <div className="flex-1">
              <p className="text-sm font-medium">{message}</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
