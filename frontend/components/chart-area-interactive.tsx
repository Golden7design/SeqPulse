"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardAction,
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
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import deploymentsData from "@/app/dashboard/deployments-data.json"
import metricsData from "@/app/dashboard/metrics-data.json"

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

const chartConfig = {
  value: {
    label: "Value",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const [metricType, setMetricType] = React.useState<"latency_p95" | "error_rate" | "requests_per_sec">("latency_p95")
  
  const deployments = deploymentsData as Deployment[]
  const allMetrics = metricsData as Metric[]
  
  // Get the latest deployment (most recent by finished_at)
  const latestDeployment = React.useMemo(() => {
    return deployments
      .filter(d => d.state === "completed")
      .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime())[0]
  }, [deployments])
  
  // Get metrics for the latest deployment
  const metrics = React.useMemo(() => {
    if (!latestDeployment) return []
    return allMetrics.filter((m) => m.deployment_id === latestDeployment.id)
  }, [allMetrics, latestDeployment])

  // Prepare chart data
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
          time: m.phase === "pre" ? "Pre" : `Post ${index}`,
          value,
          phase: m.phase,
          label,
        }
      })
  }, [metrics, metricType])

  if (!latestDeployment) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Latest Deployment Metrics</CardTitle>
          <CardDescription>
            No completed deployments found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Latest Deployment Metrics</CardTitle>
        <CardDescription>
          <span className="block">
            {latestDeployment.project} • {latestDeployment.id}
          </span>
          <span className="block text-xs mt-1">
            Pre and post-deployment metrics comparison
          </span>
        </CardDescription>
        <CardAction>
          <Tabs value={metricType} onValueChange={(value) => setMetricType(value as any)}>
            <TabsList>
              <TabsTrigger value="latency_p95">Latency P95</TabsTrigger>
              <TabsTrigger value="error_rate">Error Rate</TabsTrigger>
              <TabsTrigger value="requests_per_sec">Requests/sec</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
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
  )
}