"use client"

export function LoadingSpinner({
  size = "default",
  className = "",
}: {
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  const sizes = {
    sm: "h-6 w-6",
    default: "h-10 w-10",
    lg: "h-14 w-14",
  }

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <div className={`${sizes[size]} relative`} role="status" aria-label="Loading">
        <span className="absolute inset-0 rounded-full border-2 border-muted" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
      </div>
    </div>
  )
}

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <LoadingSpinner size="lg" />
    </div>
  )
}
