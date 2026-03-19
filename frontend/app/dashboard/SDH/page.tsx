"use client"
import * as React from "react"
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
import { Button } from "@/components/ui/button"
import { SDHPageSkeleton } from "@/components/page-skeletons"
import { useTranslation } from "@/components/providers/i18n-provider"
import { listSDH, type SDHItem } from "@/lib/dashboard-client"
import { CompositeSignalAuditCard } from "@/components/sdh/composite-audit-card"
import { resolveLocalizedList, resolveLocalizedText } from "@/lib/localized-text"

type SDH = SDHItem

function getTimeAgo(dateString: string, t: (key: string) => string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / 60000)
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) return t("common.justNow")
  if (diffInMinutes < 60) return `${diffInMinutes}${t("common.minutesAgoShort")}`
  if (diffInHours < 24) return `${diffInHours}${t("common.hoursAgoShort")}`
  return `${diffInDays}${t("common.daysAgoShort")}`
}

function formatDate(dateString: string, locale: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatMetricValue(value: number | null, metric: string, t: (key: string) => string): string {
  if (value === null) {
    return t("dashboard.sdh.na")
  }
  if (metric.includes("rate") || metric.includes("usage")) {
    return `${(value * 100).toFixed(1)}%`
  }
  if (metric.includes("latency")) {
    return `${value}ms`
  }
  return value.toString()
}

function formatRatio(value: number | null | undefined, t: (key: string) => string): string {
  if (value === null || value === undefined) return t("dashboard.sdh.na")
  return `${(value * 100).toFixed(1)}%`
}

function formatDeltaValue(value: number, metric: string): string {
  if (metric.includes("rate") || metric.includes("usage")) return `${(value * 100).toFixed(1)}%`
  if (metric.includes("latency")) return `${value.toFixed(2)}ms`
  return Number.isInteger(value) ? value.toString() : value.toFixed(2)
}

function formatMetricDelta(observed: number | null, threshold: number | null, metric: string): string | null {
  if (observed === null || threshold === null) return null

  const diff = observed - threshold
  const absDiff = Math.abs(diff)
  const absSign = diff >= 0 ? "+" : "-"

  if (threshold === 0) {
    return `Δ ${absSign}${formatDeltaValue(absDiff, metric)}`
  }

  const relDiff = (diff / Math.abs(threshold)) * 100
  const relSign = relDiff >= 0 ? "+" : "-"
  return `Δ ${absSign}${formatDeltaValue(absDiff, metric)} (${relSign}${Math.abs(relDiff).toFixed(1)}%)`
}

function formatMetricLabel(metric: string, t: (key: string) => string): string {
  return metric === "composite" ? t("dashboard.sdh.multiSignal") : metric
}

function SeverityBadge({ severity }: { severity: SDH["severity"] }) {
  const variants = {
    critical: "destructive",
    warning: "outline",
    info: "secondary",
  } as const

  return (
    <Badge variant={variants[severity]} className="gap-1.5">
      {severity === "critical" && <IconAlertTriangle className="size-4!" />}
      {severity === "warning" && <IconAlertTriangle className="size-4! text-orange-500 " />}
      {severity === "info" && <IconInfoCircle className="size-4! text-blue-500" />}
      <span className="capitalize" >{severity}</span>
    </Badge>
  )
}

function SDHDetailCard({
  sdh,
  t,
  locale,
}: {
  sdh: SDH
  t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string
  locale: string
}) {
  const hasCompositeSignals =
    sdh.metric === "composite" && (sdh.composite_signals?.length ?? 0) > 0
  const sdhTitle = resolveLocalizedText(sdh.title_i18n, t, sdh.title)
  const sdhDiagnosis = resolveLocalizedText(sdh.diagnosis_i18n, t, sdh.diagnosis)
  const sdhActions = resolveLocalizedList(sdh.suggested_actions_i18n, t, sdh.suggested_actions)
  const metricDelta = formatMetricDelta(sdh.observed_value, sdh.threshold, sdh.metric)

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
            <CardTitle className="text-lg">{sdhTitle}</CardTitle>
            <CardDescription className="mt-1">
              {formatDate(sdh.created_at, locale)} • {getTimeAgo(sdh.created_at, t)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metric Details */}
            {hasCompositeSignals ? (
          <div className="space-y-3">
            {sdh.composite_signals?.map((signal) => (
              <CompositeSignalAuditCard
                key={signal.metric}
                signal={signal}
                label={formatMetricLabel(signal.metric, t)}
                formatMetricValue={(value, metric) => formatMetricValue(value, metric, t)}
                formatRatio={(value) => formatRatio(value, t)}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.sdh.metric")}</p>
              <p className="font-mono text-sm font-medium">{formatMetricLabel(sdh.metric, t)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.sdh.observed")}</p>
              <p className="text-sm font-mono font-medium">
                {formatMetricValue(sdh.observed_value, sdh.metric, t)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.sdh.threshold")}</p>
              <p className="text-sm font-mono font-medium">
                {formatMetricValue(sdh.threshold, sdh.metric, t)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.sdh.securedThreshold")}</p>
              <p className="text-sm font-mono font-medium">
                {formatMetricValue(sdh.secured_threshold ?? null, sdh.metric, t)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.sdh.exceedRatio")}</p>
              <p className="text-sm font-mono font-medium">
                {formatRatio(sdh.exceed_ratio, t)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.sdh.tolerance")}</p>
              <p className="text-sm font-mono font-medium">
                {formatRatio(sdh.tolerance, t)}
              </p>
            </div>
            {metricDelta && (
              <p className="md:col-span-3 text-[11px] text-muted-foreground">{metricDelta}</p>
            )}
          </div>
        )}

        {/* Diagnosis */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">{t("dashboard.sdh.diagnosis")}</h4>
          <p className="text-sm text-muted-foreground">{sdhDiagnosis}</p>
        </div>

        {/* Suggested Actions */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">{t("dashboard.sdh.suggestedActions")}</h4>
          <ul className="space-y-1.5">
            {sdhActions.map((action, index) => (
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
          <span>{t("dashboard.sdh.deployment")}</span>
          <span className="font-mono font-medium text-foreground">
            #{sdh.deployment_id.replace("dpl_", "")}
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}

export default function SDHPage() {
  const { t, locale } = useTranslation()
  const [data, setData] = React.useState<SDH[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [severityFilters, setSeverityFilters] = React.useState<Record<SDH["severity"], boolean>>({
    critical: true,
    warning: true,
    info: true,
  })
  const [projectFilter, setProjectFilter] = React.useState<string>("all")
  const [envFilter, setEnvFilter] = React.useState<string>("all")
  const [timeRange, setTimeRange] = React.useState<"24h" | "7d" | "30d" | "all">("7d")
  const [sortBy, setSortBy] = React.useState<"recent" | "severity">("recent")
  const [visibleCount, setVisibleCount] = React.useState<number>(50)

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const diagnostics = await listSDH({ limit: 200 })
        if (cancelled) return
        setData(diagnostics)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : t("dashboard.sdh.loadError")
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [t])

  const uniqueProjects = React.useMemo(() => Array.from(new Set(data.map((d) => d.project))), [data])
  const uniqueEnvs = React.useMemo(() => Array.from(new Set(data.map((d) => d.env))), [data])

  const filtered = React.useMemo(() => {
    const now = Date.now()
    const timeLimit =
      timeRange === "24h"
        ? now - 24 * 60 * 60 * 1000
        : timeRange === "7d"
          ? now - 7 * 24 * 60 * 60 * 1000
          : timeRange === "30d"
            ? now - 30 * 24 * 60 * 60 * 1000
            : 0

    return data
      .filter((sdh) => severityFilters[sdh.severity])
      .filter((sdh) => (projectFilter === "all" ? true : sdh.project === projectFilter))
      .filter((sdh) => (envFilter === "all" ? true : sdh.env === envFilter))
      .filter((sdh) => {
        if (timeLimit === 0) return true
        const created = new Date(sdh.created_at).getTime()
        return created >= timeLimit
      })
  }, [data, severityFilters, projectFilter, envFilter, timeRange])

  const sorted = React.useMemo(() => {
    const list = [...filtered]
    if (sortBy === "recent") {
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    // severity sort: critical > warning > info, then recent
    const score = { critical: 3, warning: 2, info: 1 } as const
    return list.sort((a, b) => {
      const diff = score[b.severity] - score[a.severity]
      if (diff !== 0) return diff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [filtered, sortBy])

  const visible = sorted.slice(0, visibleCount)
  const canLoadMore = sorted.length > visible.length

  if (loading) {
    return <SDHPageSkeleton />
  }

  return (
          <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("dashboard.sdh.pageTitle")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("dashboard.sdh.pageDescription")}
        </p>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-background px-3 py-3 shadow-sm flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {(["critical", "warning", "info"] as SDH["severity"][]).map((sev) => {
            const active = severityFilters[sev]
            return (
              <Button
                key={sev}
                variant={active ? "default" : "outline"}
                size="xs"
                className="capitalize h-8 px-3"
                aria-pressed={active}
                onClick={() =>
                  setSeverityFilters((prev) => ({ ...prev, [sev]: !prev[sev] }))
                }
              >
                {sev}
              </Button>
            )
          })}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:items-center md:gap-2">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm w-full"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">All projects</option>
            {uniqueProjects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm w-full"
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
          >
            <option value="all">All envs</option>
            {uniqueEnvs.map((env) => (
              <option key={env} value={env}>{env}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm w-full"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
          >
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
            <option value="all">All time</option>
          </select>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm w-full"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="recent">Recent first</option>
            <option value="severity">Severity</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            className="col-span-2 md:col-span-1"
            onClick={() => {
              setSeverityFilters({ critical: true, warning: true, info: true })
              setProjectFilter("all")
              setEnvFilter("all")
              setTimeRange("7d")
              setSortBy("recent")
              setVisibleCount(50)
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* SDH List */}
      <div className="space-y-4">
        {visible.map((sdh) => (
          <SDHDetailCard key={sdh.id} sdh={sdh} t={t} locale={locale} />
        ))}

        {visible.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">{t("dashboard.sdh.noDiagnostics")}</p>
            </CardContent>
          </Card>
        )}

        {canLoadMore && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setVisibleCount((c) => c + 50)}>
              Load more
            </Button>
          </div>
        )}
      </div>
      </div>
      )
}
