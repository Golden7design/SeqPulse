"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconCircleCheckFilled,
  IconAlertTriangle,
  IconRotateClockwise2,
  IconClock,
  IconChevronLeft,
  IconChevronRight,
  IconInfoCircle,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslation } from "@/components/providers/i18n-provider"
import {
  getDeployment,
  getDeploymentMetrics,
  listDeployments,
  listSDH,
  type DeploymentDashboard,
  type MetricSample,
  type SDHItem,
} from "@/lib/dashboard-client"
import {
  deploymentNumberToDisplay,
  projectNameToPathSegment,
} from "@/lib/deployment-format"

type MetricType = "latency_p95" | "error_rate" | "requests_per_sec"

function formatMetricValue(value: number | null, metric: string): string {
  if (value === null || metric === "composite") return "N/A"
  if (metric.includes("rate") || metric.includes("usage")) return `${(value * 100).toFixed(1)}%`
  if (metric.includes("latency")) return `${value}ms`
  return value.toString()
}

function formatMetricLabel(metric: string): string {
  return metric === "composite" ? "multi-signal" : metric
}

function getVerdictIcon(verdict: string) {
  switch (verdict) {
    case "ok":
      return <IconCircleCheckFilled className="size-5 text-green-500" />
    case "warning":
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
    case "warning":
      return "Warning"
    case "rollback_recommended":
      return "Rollback Recommended"
    default:
      return verdict
  }
}

function getPipelineResultVariant(result: string | null): "default" | "destructive" | "outline" {
  switch (result) {
    case "success":
      return "outline"
    case "failed":
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

export default function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ projectName: string; deploymentId: string }>
}) {
  const router = useRouter()
  const { deploymentId: rawDeploymentId, projectName: rawProjectName } = React.use(params)
  const deploymentId = decodeURIComponent(rawDeploymentId)
  const projectSegment = decodeURIComponent(rawProjectName)
  const [metricType, setMetricType] = React.useState<MetricType>("latency_p95")
  const [deployment, setDeployment] = React.useState<DeploymentDashboard | null>(null)
  const [metrics, setMetrics] = React.useState<MetricSample[]>([])
  const [deploymentSDH, setDeploymentSDH] = React.useState<SDHItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const { t } = useTranslation()

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        let lookupId = deploymentId
        if (deploymentId.startsWith("dpl_")) {
          const deployments = await listDeployments()
          const deploymentNumber = Number.parseInt(deploymentId.slice(4), 10)
          if (Number.isFinite(deploymentNumber)) {
            const resolved = deployments.find(
              (item) =>
                item.deployment_number === deploymentNumber &&
                projectNameToPathSegment(item.project) === projectSegment
            )
            if (resolved?.internal_id) {
              lookupId = resolved.internal_id
            }
          }
        }

        const [deploymentData, metricsData, sdhData] = await Promise.all([
          getDeployment(lookupId),
          getDeploymentMetrics(lookupId),
          listSDH({ deployment_id: lookupId, limit: 200 }),
        ])
        if (cancelled) return

        const canonicalProjectSegment = projectNameToPathSegment(deploymentData.project)
        if (lookupId !== deploymentId || canonicalProjectSegment !== projectSegment) {
          router.replace(`/dashboard/deployments/${canonicalProjectSegment}/${deploymentData.internal_id}`)
        }

        setDeployment(deploymentData)
        setMetrics(metricsData)
        setDeploymentSDH(sdhData)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "Unable to load deployment."
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [deploymentId, projectSegment, router])

  const chartData = React.useMemo(() => {
    return metrics
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
  }, [metrics, metricType])

  if (!loading && !deployment) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              {error ?? t("deployments.deploymentsNotFound")}
            </p>
            <Link href="/dashboard/deployments">
              <Button variant="outline" className="mt-4">
                ← {t("deployments.BackToDeployments")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!deployment) {
    return <div className="p-6 text-sm text-muted-foreground">Loading deployment...</div>
  }

  const displayId = deploymentNumberToDisplay(deployment.deployment_number)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Link href="/dashboard/deployments">
        <Button variant="ghost" size="sm">
          <IconChevronLeft />
          {t("deployments.BackToDeployments")}
        </Button>
      </Link>

      <div>
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">Deployment {displayId}</h1>
          <Badge variant="outline" className="font-mono">
            {deployment.project}
          </Badge>
        </div>
        <p className="text-muted-foreground">{t("deployments.deploymentDetailsDescription")}</p>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("deployments.deploymentInformation")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Deployment</p>
              <p className="font-mono font-medium">{displayId}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Environment</p>
              <Badge variant={getEnvVariant(deployment.env)} className="capitalize">
                {deployment.env}
              </Badge>
            </div>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Pipeline Result</p>
              <Badge variant={getPipelineResultVariant(deployment.pipeline_result)} className="capitalize">
                {deployment.pipeline_result ?? "unknown"}
              </Badge>
            </div>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">State</p>
              <p className="font-medium capitalize">{deployment.state}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Started At</p>
              <p className="text-sm">{formatDate(deployment.started_at)}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Finished At</p>
              <p className="text-sm">{formatDate(deployment.finished_at)}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Duration</p>
              <div className="flex items-center gap-1.5">
                <IconClock className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">{formatDuration(deployment.duration_ms)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <CardTitle>{t("deployments.metricsTimeline")}</CardTitle>
              <CardDescription>{t("deployments.metricsTimelineDescription")}</CardDescription>
            </div>
            <div className="flex justify-center md:items-start md:justify-end">
              <Tabs value={metricType} onValueChange={(value) => setMetricType(value as MetricType)}>
                <TabsList>
                  <TabsTrigger value="latency_p95">Latency P95</TabsTrigger>
                  <TabsTrigger value="error_rate">Error Rate</TabsTrigger>
                  <TabsTrigger value="requests_per_sec">Requests/sec</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
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
              {t("deployments.noMetricsDataAvailable")}
            </div>
          )}
        </CardContent>
      </Card>

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

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Diagnostic Hints (SDH)</h2>
          <p className="text-sm text-muted-foreground">{t("deployments.sdhDescription")}</p>
        </div>
        {deploymentSDH.length > 0 ? (
          deploymentSDH.map((sdh) => (
            <Card key={sdh.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant={getSeverityVariant(sdh.severity)} className="gap-1.5">
                        {getSeverityIcon(sdh.severity)}
                        <span className="capitalize">{sdh.severity}</span>
                      </Badge>
                      <Badge variant="outline" className="font-mono text-xs">
                        {formatMetricLabel(sdh.metric)}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{sdh.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {sdh.metric === "composite" && (sdh.composite_signals?.length ?? 0) > 0 ? (
                  <div className="rounded-lg border p-4">
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground">Metric</p>
                      <p className="font-mono text-sm font-semibold">{formatMetricLabel(sdh.metric)}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {sdh.composite_signals?.map((signal) => (
                        <div key={signal.metric} className="w-full rounded-md border bg-muted/20 p-3">
                          <p className="font-mono text-sm font-semibold">{formatMetricLabel(signal.metric)}</p>
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="rounded-md border bg-background/70 p-2.5">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Observed</p>
                              <p className="mt-1 text-sm font-semibold">
                                {formatMetricValue(signal.observed_value, signal.metric)}
                              </p>
                            </div>
                            <div className="rounded-md border bg-background/70 p-2.5">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Threshold</p>
                              <p className="mt-1 text-sm font-semibold">
                                {formatMetricValue(signal.threshold, signal.metric)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Observed Value</p>
                      <p className="text-sm font-medium">{formatMetricValue(sdh.observed_value, sdh.metric)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Threshold</p>
                      <p className="text-sm font-medium">{formatMetricValue(sdh.threshold, sdh.metric)}</p>
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Diagnosis</h4>
                  <p className="text-sm text-muted-foreground">{sdh.diagnosis}</p>
                </div>
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
    </div>
  )
}
