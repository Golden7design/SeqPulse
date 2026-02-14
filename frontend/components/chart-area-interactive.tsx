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
  const [metricType, setMetricType] = React.useState<MetricType>("latency_p95")

  const latestDeployment = React.useMemo(() => {
    return deployments
      .filter((deployment) => deployment.state === "analyzed" || deployment.state === "finished")
      .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime())[0]
  }, [deployments])

  const chartData = React.useMemo(() => {
    return metrics
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
          <CardTitle>Latest Deployment Metrics</CardTitle>
          <CardDescription>No analyzed deployments found</CardDescription>
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
            <CardTitle>Latest Deployment Metrics</CardTitle>
            <CardDescription>
              <span className="block">
                {latestDeployment.project} • {deploymentNumberToDisplay(latestDeployment.deployment_number)}
              </span>
              <span className="mt-1 block text-xs">Pre and post-deployment metrics comparison</span>
            </CardDescription>
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
          <div className="flex items-center justify-center py-12 text-muted-foreground">No metrics data available</div>
        )}
      </CardContent>
    </Card>
  )
}
