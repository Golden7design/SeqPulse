import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-8">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-2/3" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-12 w-full rounded-full sm:w-40" />
          <Skeleton className="h-12 w-full rounded-full sm:w-40" />
        </div>
      </div>
    </div>
  )
}
