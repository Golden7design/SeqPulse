"use client"

import { FullPageAppSkeleton } from "@/components/page-skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export function LoadingSpinner({
  size = "default",
  className = "",
}: {
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  const sizes = {
    sm: "h-6 w-6 rounded-full",
    default: "h-10 w-10 rounded-full",
    lg: "h-14 w-14 rounded-full",
  }

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <Skeleton className={sizes[size]} role="status" aria-label="Loading placeholder" />
    </div>
  )
}

export function FullPageLoader() {
  return <FullPageAppSkeleton />
}
