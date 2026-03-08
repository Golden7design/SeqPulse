"use client"

import { Badge } from "@/components/ui/badge"

export type CompositeSignal = {
  metric: string
  observed_value: number | null
  threshold: number | null
  secured_threshold?: number | null
  exceed_ratio?: number | null
  tolerance?: number | null
}

type Props = {
  signal: CompositeSignal
  label: string
  formatMetricValue: (value: number | null, metric: string) => string
  formatRatio: (value: number | null | undefined) => string
  t: (key: string) => string
}

function formatDeltaValue(value: number, metric: string): string {
  if (metric.includes("rate") || metric.includes("usage")) return `${(value * 100).toFixed(1)}%`
  if (metric.includes("latency")) return `${value.toFixed(2)}ms`
  return Number.isInteger(value) ? value.toString() : value.toFixed(2)
}

function formatMetricDelta(
  observed: number | null,
  threshold: number | null,
  metric: string,
): string | null {
  if (observed === null || threshold === null || metric === "composite") return null

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

export function CompositeSignalAuditCard({
  signal,
  label,
  formatMetricValue,
  formatRatio,
  t,
}: Props) {
  const metricDelta = formatMetricDelta(signal.observed_value, signal.threshold, signal.metric)

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-sm font-semibold">{label}</p>
        <Badge variant="secondary" className="text-[11px] uppercase tracking-wide">
          {t("dashboard.sdh.auditBadge")}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border bg-background/70 p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("dashboard.sdh.observed")}
          </p>
          <p className="mt-1 text-sm font-semibold">
            {formatMetricValue(signal.observed_value, signal.metric)}
          </p>
        </div>
        <div className="rounded-md border bg-background/70 p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("dashboard.sdh.threshold")}
          </p>
          <p className="mt-1 text-sm font-semibold">
            {formatMetricValue(signal.threshold, signal.metric)}
          </p>
        </div>
        <div className="rounded-md border bg-background/70 p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("dashboard.sdh.securedThreshold")}
          </p>
          <p className="mt-1 text-sm font-semibold">
            {formatMetricValue(signal.secured_threshold ?? null, signal.metric)}
          </p>
        </div>
        <div className="rounded-md border bg-background/70 p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("dashboard.sdh.exceedRatio")}
          </p>
          <p className="mt-1 text-sm font-semibold">
            {formatRatio(signal.exceed_ratio)}
          </p>
        </div>
        <div className="rounded-md border bg-background/70 p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("dashboard.sdh.tolerance")}
          </p>
          <p className="mt-1 text-sm font-semibold">
            {formatRatio(signal.tolerance)}
          </p>
        </div>
        {metricDelta && (
          <p className="sm:col-span-2 text-[11px] text-muted-foreground">{metricDelta}</p>
        )}
      </div>
    </div>
  )
}
