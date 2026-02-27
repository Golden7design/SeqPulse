"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
import type { DeploymentDashboard, MetricSample } from "@/lib/dashboard-client"
import { deploymentNumberToDisplay } from "@/lib/deployment-format"

const chartConfig = {
  value: {
    label: "Value",
    color: "var(--primary)",
  },
} satisfies ChartConfig

type MetricType = "latency_p95" | "error_rate" | "requests_per_sec"

export function ChartAreaInteractive({
  deployments,
  metrics,
}: {
  deployments: DeploymentDashboard[]
  metrics: MetricSample[]
}) {
  const { t } = useTranslation()
  const [metricType, setMetricType] = React.useState<MetricType>("latency_p95")

  const metricLabels: Record<MetricType, string> = React.useMemo(
    () => ({
      latency_p95: "Latency P95",
      error_rate: "Error Rate",
      requests_per_sec: "Requests/sec",
    }),
    []
  )

  const latestDeployment = React.useMemo(() => {
    return deployments
      .filter((deployment) => deployment.state === "analyzed" || deployment.state === "finished")
      .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime())[0]
  }, [deployments])

  const chartData = React.useMemo(() => {
    return [...metrics]
      .sort((a, b) => new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime())
      .map((metric, index) => {
        let value = 0
        let label = ""

        switch (metricType) {
          case "latency_p95":
            value = metric.latency_p95
            label = "Latency P95 (ms)"
            break
          case "error_rate":
            value = metric.error_rate * 100
            label = "Error Rate (%)"
            break
          case "requests_per_sec":
            value = metric.requests_per_sec
            label = "Requests/sec"
            break
        }

        return {
          time: metric.phase === "pre" ? "t0 (PRE)" : `t${index} (POST)`,
          value,
          phase: metric.phase,
          label,
        }
      })
  }, [metrics, metricType])

  if (!latestDeployment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl leading-tight md:text-2xl">
            {t("deployments.latestDeployment")}
          </CardTitle>
          <CardDescription>{t("deployments.noMetricsDataAvailable")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">No data available</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl leading-tight md:text-2xl">
              {t("deployments.latestDeployment")}
            </CardTitle>
            <div className="mt-1 space-y-0.5">
              <p className="text-sm font-semibold text-foreground sm:text-base">
                {latestDeployment.project} • {deploymentNumberToDisplay(latestDeployment.deployment_number)}
              </p>
              <CardDescription className="text-xs sm:text-sm">
                {t("deployments.metricsTimelineDescription")}
              </CardDescription>
            </div>
          </div>
          <div className="flex w-full justify-center md:w-auto md:items-start md:justify-end">
            <Tabs value={metricType} onValueChange={(value) => setMetricType(value as MetricType)}>
              <TabsList className="grid w-full grid-cols-3 md:w-auto">
                <TabsTrigger className="text-xs sm:text-sm" value="latency_p95">
                  {metricLabels.latency_p95}
                </TabsTrigger>
                <TabsTrigger className="text-xs sm:text-sm" value="error_rate">
                  {metricLabels.error_rate}
                </TabsTrigger>
                <TabsTrigger className="text-xs sm:text-sm" value="requests_per_sec">
                  {metricLabels.requests_per_sec}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[240px] w-full sm:h-[300px]">
            <AreaChart
              data={chartData}
              margin={{
                top: 8,
                right: 8,
                left: 0,
                bottom: 0,
              }}
            >
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
                minTickGap={18}
                interval="preserveStartEnd"
                tick={{ fontSize: 11 }}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={34} tick={{ fontSize: 11 }} />
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
          <div className="flex items-center justify-center py-12 text-muted-foreground">No metrics data available</div>
        )}
      </CardContent>
    </Card>
  )
}
