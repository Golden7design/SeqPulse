"use client"

import { IconAlertTriangle, IconInfoCircle, IconChevronRight } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import sdhData from "../sdh-data.json"

type SDH = {
  id: string
  deployment_id: string
  project: string
  env: string
  severity: "critical" | "warning" | "info"
  metric: string
  observed_value: number | null
  threshold: number | null
  confidence?: number
  title: string
  diagnosis: string
  suggested_actions: string[]
  created_at: string
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / 60000)
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) return "just now"
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`
  if (diffInHours < 24) return `${diffInHours}h ago`
  return `${diffInDays}d ago`
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

function formatMetricValue(value: number | null, metric: string): string {
  if (value === null || metric === "composite") {
    return "N/A"
  }
  if (metric.includes("rate") || metric.includes("usage")) {
    return `${(value * 100).toFixed(1)}%`
  }
  if (metric.includes("latency")) {
    return `${value}ms`
  }
  return value.toString()
}

function formatMetricLabel(metric: string): string {
  return metric === "composite" ? "multi-signal" : metric
}

function SeverityBadge({ severity }: { severity: SDH["severity"] }) {
  const variants = {
    critical: "destructive",
    warning: "outline",
    info: "secondary",
  } as const

  return (
    <Badge variant={variants[severity]} className="gap-1.5">
      {severity === "critical" && <IconAlertTriangle className="!size-4" />}
      {severity === "warning" && <IconAlertTriangle className="!size-4 text-orange-500 " />}
      {severity === "info" && <IconInfoCircle className="!size-4 text-blue-500" />}
      <span className="capitalize" >{severity}</span>
    </Badge>
  )
}

function SDHDetailCard({ sdh }: { sdh: SDH }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <SeverityBadge severity={sdh.severity} />
              <Badge variant="outline" className="font-mono text-xs">
                {sdh.project}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {sdh.env}
              </Badge>
            </div>
            <CardTitle className="text-lg">{sdh.title}</CardTitle>
            <CardDescription className="mt-1">
              {formatDate(sdh.created_at)} • {getTimeAgo(sdh.created_at)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metric Details */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Metric</p>
            <p className="font-mono text-sm font-medium">{formatMetricLabel(sdh.metric)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Observed</p>
            <p className="text-sm font-mono font-medium">
              {formatMetricValue(sdh.observed_value, sdh.metric)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Threshold</p>
            <p className="text-sm font-mono font-medium">
              {formatMetricValue(sdh.threshold, sdh.metric)}
            </p>
          </div>
        </div>

        {/* Diagnosis */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">Diagnosis</h4>
          <p className="text-sm text-muted-foreground">{sdh.diagnosis}</p>
        </div>

        {/* Suggested Actions */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">Suggested Actions</h4>
          <ul className="space-y-1.5">
            {sdh.suggested_actions.map((action, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <IconChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Deployment</span>
          <span className="font-mono font-medium text-foreground">
            #{sdh.deployment_id.replace("dpl_", "")}
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}

export default function SDHPage() {
  const data = sdhData as SDH[]

  // Group by severity for better organization
  const criticalSDH = data.filter((sdh) => sdh.severity === "critical")
  const warningSDH = data.filter((sdh) => sdh.severity === "warning")
  const infoSDH = data.filter((sdh) => sdh.severity === "info")

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">SDH - Diagnostic Hints</h1>
        <p className="text-muted-foreground mt-1">
          SeqPulse deployment diagnostics and recommendations
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Critical</CardDescription>
            <CardTitle className="text-3xl text-destructive">
              {criticalSDH.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Warnings</CardDescription>
            <CardTitle className="text-3xl text-orange-500">
              {warningSDH.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription >Info</CardDescription>
            <CardTitle className="text-3xl text-blue-500">
              {infoSDH.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* SDH List */}
      <div className="space-y-4">
        {criticalSDH.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[18px] font-semibold text-destructive">
              Critical Issues
            </h2>
            {criticalSDH.map((sdh) => (
              <SDHDetailCard key={sdh.id} sdh={sdh} />
            ))}
          </div>
        )}

        {warningSDH.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[18px] font-semibold text-orange-500">Warnings</h2>
            {warningSDH.map((sdh) => (
              <SDHDetailCard key={sdh.id} sdh={sdh} />
            ))}
          </div>
        )}

        {infoSDH.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[18px] font-semibold text-blue-500">
              Informational
            </h2>
            {infoSDH.map((sdh) => (
              <SDHDetailCard key={sdh.id} sdh={sdh} />
            ))}
          </div>
        )}

        {data.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No diagnostics available</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
