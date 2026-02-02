"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { 
  IconCircleCheckFilled, 
  IconAlertTriangle, 
  IconRotateClockwise2,
  IconClock,
  IconRocket,
  IconFilter
} from "@tabler/icons-react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import deploymentsData from "../deployments-data.json"

type Deployment = {
  id: string
  project: string
  env: string
  pipeline_result: string
  verdict: {
    verdict: "ok" | "attention" | "rollback_recommended"
    confidence: number
    summary: string
    details: string[]
  }
  state: string
  started_at: string
  finished_at: string
  duration_ms: number
}

function getVerdictIcon(verdict: string) {
  switch (verdict) {
    case "ok":
      return <IconCircleCheckFilled className="size-4 text-green-500" />
    case "attention":
      return <IconAlertTriangle className="size-4 text-orange-500" />
    case "rollback_recommended":
      return <IconRotateClockwise2 className="size-4 text-white" />
    default:
      return null
  }
}

function getVerdictLabel(verdict: string) {
  switch (verdict) {
    case "ok":
      return "OK"
    case "attention":
      return "Attention"
    case "rollback_recommended":
      return "Rollback Recommended"
    default:
      return verdict
  }
}

function getVerdictVariant(verdict: string): "default" | "destructive" | "outline" {
  switch (verdict) {
    case "ok":
      return "outline"
    case "attention":
      return "outline"
    case "rollback_recommended":
      return "destructive"
    default:
      return "outline"
  }
}

function getPipelineResultVariant(result: string): "default" | "destructive" | "outline" {
  switch (result) {
    case "success":
      return "outline"
    case "failure":
      return "destructive"
    default:
      return "outline"
  }
}

function getEnvVariant(env: string): "default" | "secondary" | "outline" {
  switch (env) {
    case "prod":
      return "default"
    case "staging":
      return "secondary"
    case "dev":
      return "outline"
    default:
      return "outline"
  }
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const columns: ColumnDef<Deployment>[] = [
  {
    accessorKey: "project",
    header: "Project",
    cell: ({ row }) => (
      <div className="font-mono text-sm font-medium">{row.original.project}</div>
    ),
  },
  {
    accessorKey: "env",
    header: "Environment",
    cell: ({ row }) => (
      <Badge variant={getEnvVariant(row.original.env)} className="capitalize">
        {row.original.env}
      </Badge>
    ),
  },
  {
    accessorKey: "pipeline_result",
    header: "Pipeline",
    cell: ({ row }) => (
      <Badge variant={getPipelineResultVariant(row.original.pipeline_result)} className="capitalize">
        {row.original.pipeline_result}
      </Badge>
    ),
  },
  {
    id: "verdict",
    accessorFn: (row) => row.verdict?.verdict ?? "",
    header: "Verdict",
    cell: ({ row }) => (
      <Badge variant={getVerdictVariant(row.original.verdict.verdict)} className="gap-1.5">
        {getVerdictIcon(row.original.verdict.verdict)}
        {getVerdictLabel(row.original.verdict.verdict)}
      </Badge>
    ),
  },
  {
    accessorKey: "started_at",
    header: "Started At",
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {formatDate(row.original.started_at)}
      </div>
    ),
  },
  {
    accessorKey: "duration_ms",
    header: "Duration",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-sm">
        <IconClock className="size-3 text-muted-foreground" />
        {formatDuration(row.original.duration_ms)}
      </div>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Link href={`/dashboard/deployments/${row.original.id}`}>
        <Button variant="ghost" size="sm">
          View Details →
        </Button>
      </Link>
    ),
  },
]

export default function DeploymentsPage() {
  const data = deploymentsData as Deployment[]
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const searchParams = useSearchParams()

  React.useEffect(() => {
    const vp = searchParams?.get("verdict")
    if (vp) {
      const mapped = vp === "rollback" ? "rollback_recommended" : vp
      table.getColumn("verdict")?.setFilterValue(mapped)
    }
  }, [searchParams, table])

  // Get unique values for filters
  const uniqueProjects = Array.from(new Set(data.map(d => d.project)))
  const uniqueEnvs = Array.from(new Set(data.map(d => d.env)))
  const uniqueVerdicts = Array.from(new Set(data.map(d => d.verdict.verdict)))

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Deployments</h1>
        <p className="text-muted-foreground">
          Monitor and track all your deployments across projects
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Deployments</CardDescription>
            <CardTitle className="text-3xl">{data.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Successful</CardDescription>
            <CardTitle className="text-3xl text-green-500">
              {data.filter(d => d.verdict.verdict === "ok").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Needs Attention</CardDescription>
            <CardTitle className="text-3xl text-orange-500">
              {data.filter(d => d.verdict.verdict === "attention").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Rollback Recommended</CardDescription>
            <CardTitle className="text-3xl text-destructive">
              {data.filter(d => d.verdict.verdict === "rollback_recommended").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconFilter className="size-5" />
            <CardTitle>Filters</CardTitle>
          </div>
          <CardDescription>Filter deployments by project, environment, or verdict</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project</label>
              <Select
                value={(table.getColumn("project")?.getFilterValue() as string) ?? "all"}
                onValueChange={(value) =>
                  table.getColumn("project")?.setFilterValue(value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {uniqueProjects.map((project) => (
                    <SelectItem key={project} value={project}>
                      {project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Environment</label>
              <Select
                value={(table.getColumn("env")?.getFilterValue() as string) ?? "all"}
                onValueChange={(value) =>
                  table.getColumn("env")?.setFilterValue(value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Environments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Environments</SelectItem>
                  {uniqueEnvs.map((env) => (
                    <SelectItem key={env} value={env}>
                      {env}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Verdict</label>
              <Select
                value={(table.getColumn("verdict")?.getFilterValue() as string) ?? "all"}
                onValueChange={(value) =>
                  table.getColumn("verdict")?.setFilterValue(value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Verdicts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Verdicts</SelectItem>
                  {uniqueVerdicts.map((verdict) => (
                    <SelectItem key={verdict} value={verdict}>
                      {getVerdictLabel(verdict)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search deployments..."
                value={(table.getColumn("project")?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  table.getColumn("project")?.setFilterValue(event.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No deployments found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4">
        <div className="text-muted-foreground text-sm">
          Showing {table.getRowModel().rows.length} of {data.length} deployments
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}