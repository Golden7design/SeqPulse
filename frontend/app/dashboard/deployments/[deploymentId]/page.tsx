"use client"

import { use, useState } from "react"
import Link from "next/link"
import { 
  IconCircleCheckFilled, 
  IconAlertTriangle, 
  IconRotateClockwise2,
  IconClock,
  IconChevronLeft,
  IconChevronRight,
  IconInfoCircle
} from "@tabler/icons-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import deploymentsData from "../../deployments-data.json"
import metricsData from "../../metrics-data.json"
import sdhData from "../../sdh-data.json"

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

type Metric = {
  id: string
  deployment_id: string
  phase: "pre" | "post"
  requests_per_sec: number
  latency_p95: number
  error_rate: number
  cpu_usage: number
  memory_usage: number
  collected_at: string
}

type SDH = {
  id: string
  deployment_id: string
  project: string
  env: string
  severity: "critical" | "warning" | "info"
  metric: string
  observed_value: number
  threshold: number
  title: string
  diagnosis: string
  suggested_actions: string[]
  created_at: string
}

function getVerdictIcon(verdict: string) {
  switch (verdict) {
    case "ok":
      return <IconCircleCheckFilled className="size-5 text-green-500" />
    case "attention":
      return <IconAlertTriangle className="size-5 text-orange-500" />
    case "rollback_recommended":
      return <IconRotateClockwise2 className="size-5 text-muted-foreground" />
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

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical":
      return <IconAlertTriangle className="!size-4 text-white" />
    case "warning":
      return <IconAlertTriangle className="!size-4 text-orange-500" />
    case "info":
      return <IconInfoCircle className="!size-4 text-blue-500" />
    default:
      return null
  }
}

function getSeverityVariant(severity: string): "default" | "destructive" | "outline" {
  switch (severity) {
    case "critical":
      return "destructive"
    case "warning":
      return "outline"
    case "info":
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

const chartConfig = {
  value: {
    label: "Value",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export default function DeploymentDetailPage({ params }: { params: Promise<{ deploymentId: string }> }) {
  const { deploymentId } = use(params)
  const [metricType, setMetricType] = useState<"latency_p95" | "error_rate" | "requests_per_sec">("latency_p95")
  
  const deployments = deploymentsData as Deployment[]
  const deployment = deployments.find((d) => d.id === deploymentId)
  const allMetrics = metricsData as Metric[]
  const metrics = allMetrics.filter((m) => m.deployment_id === deploymentId)
  const allSDH = sdhData as SDH[]
  const deploymentSDH = allSDH.filter((s) => s.deployment_id === deploymentId)

  if (!deployment) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Deployment not found</p>
            <Link href="/dashboard/deployments">
              <Button variant="outline" className="mt-4">
                ← Back to Deployments
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Prepare chart data
  const chartData = metrics
    .sort((a, b) => new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime())
    .map((m, index) => {
      let value = 0
      let label = ""
      
      switch (metricType) {
        case "latency_p95":
          value = m.latency_p95
          label = "Latency P95 (ms)"
          break
        case "error_rate":
          value = m.error_rate * 100
          label = "Error Rate (%)"
          break
        case "requests_per_sec":
          value = m.requests_per_sec
          label = "Requests/sec"
          break
      }

      return {
        time: m.phase === "pre" ? "t0 (PRE)" : `t${index} (POST)`,
        value,
        phase: m.phase,
        label,
      }
    })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Back Button */}
      <Link href="/dashboard/deployments">
        <Button variant="ghost" size="sm">
          <IconChevronLeft />
          Back to Deployments
        </Button>
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">Deployment Details</h1>
          <Badge variant="outline" className="font-mono">
            {deployment.id}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Comprehensive analysis and metrics for this deployment
        </p>
      </div>

      {/* Main Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Project</p>
              <p className="font-mono font-medium">{deployment.project}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Environment</p>
              <Badge variant={getEnvVariant(deployment.env)} className="capitalize">
                {deployment.env}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pipeline Result</p>
              <Badge variant={getPipelineResultVariant(deployment.pipeline_result)} className="capitalize">
                {deployment.pipeline_result}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">State</p>
              <p className="font-medium capitalize">{deployment.state}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Started At</p>
              <p className="text-sm">{formatDate(deployment.started_at)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Finished At</p>
              <p className="text-sm">{formatDate(deployment.finished_at)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Duration</p>
              <div className="flex items-center gap-1.5">
                <IconClock className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">{formatDuration(deployment.duration_ms)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Metrics Timeline</CardTitle>
          <CardDescription>
            Pre and post-deployment metrics comparison
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Metric Selector */}
          <Tabs value={metricType} onValueChange={(value) => setMetricType(value as any)}>
            <TabsList>
              <TabsTrigger value="latency_p95">Latency P95</TabsTrigger>
              <TabsTrigger value="error_rate">Error Rate</TabsTrigger>
              <TabsTrigger value="requests_per_sec">Requests/sec</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Chart */}
          {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-value)"
                  fill="url(#fillValue)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              No metrics data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verdict Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {getVerdictIcon(deployment.verdict.verdict)}
            <div>
              <CardTitle>Verdict: {getVerdictLabel(deployment.verdict.verdict)}</CardTitle>
              <CardDescription>
                Confidence: {(deployment.verdict.confidence * 100).toFixed(0)}%
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Summary</h4>
            <p className="text-sm text-muted-foreground">{deployment.verdict.summary}</p>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Details</h4>
            <ul className="space-y-1.5">
              {deployment.verdict.details.map((detail, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <IconChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* SDH Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Diagnostic Hints (SDH)</h2>
          <p className="text-muted-foreground text-sm">
            Automated diagnostics and recommendations for this deployment
          </p>
        </div>

        {deploymentSDH.length > 0 ? (
          deploymentSDH.map((sdh) => (
            <Card key={sdh.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getSeverityVariant(sdh.severity)} className="gap-1.5">
                        {getSeverityIcon(sdh.severity)}
                        <span className="capitalize">{sdh.severity}</span>
                      </Badge>
                      <Badge variant="outline" className="font-mono text-xs">
                        {sdh.metric}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{sdh.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Metric Details */}
                <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Observed Value</p>
                    <p className="text-sm font-medium">
                      {sdh.observed_value}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Threshold</p>
                    <p className="text-sm font-medium">
                      {sdh.threshold}
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
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <IconCircleCheckFilled className="size-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No diagnostic hints available for this deployment
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>Additional deployment information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Deployment State</p>
              <p className="font-medium capitalize">{deployment.state}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pipeline Result</p>
              <Badge variant={getPipelineResultVariant(deployment.pipeline_result)} className="capitalize">
                {deployment.pipeline_result}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Environment</p>
              <Badge variant={getEnvVariant(deployment.env)} className="capitalize">
                {deployment.env}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}