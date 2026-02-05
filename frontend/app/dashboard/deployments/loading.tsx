import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const statCards = Array.from({ length: 4 })
const tableRows = Array.from({ length: 6 })

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {statCards.map((_, index) => (
          <Card key={`stat-${index}`}>
            <CardHeader className="pb-3">
              <CardDescription>
                <Skeleton className="h-4 w-32" />
              </CardDescription>
              <CardTitle>
                <Skeleton className="h-8 w-16" />
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <CardTitle>
              <Skeleton className="h-5 w-28" />
            </CardTitle>
          </div>
          <CardDescription>
            <Skeleton className="h-4 w-72" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`filter-${index}`} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border">
        <div className="bg-muted px-4 py-3">
          <div className="grid grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={`head-${index}`} className="h-4 w-20" />
            ))}
          </div>
        </div>
        <div className="divide-y">
          {tableRows.map((_, index) => (
            <div key={`row-${index}`} className="grid grid-cols-7 gap-4 px-4 py-3">
              {Array.from({ length: 7 }).map((__, cellIndex) => (
                <Skeleton key={`cell-${index}-${cellIndex}`} className="h-4 w-20" />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-4">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  )
}
