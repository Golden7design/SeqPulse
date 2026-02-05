import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-4xl">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`section-${index}`} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-64" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-full max-w-md" />
              <Skeleton className="h-10 w-28" />
            </div>
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>

      <div className="my-6 h-px w-full bg-border" />

      <div className="space-y-4">
        <Skeleton className="h-7 w-44" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
      </div>

      <div className="my-6 h-px w-full bg-border" />

      <div className="space-y-4">
        <Skeleton className="h-7 w-52" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`notif-${index}`} className="flex items-start gap-3 rounded-lg border p-4">
            <Skeleton className="h-6 w-6 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
