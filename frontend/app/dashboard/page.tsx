"use client"

import { useEffect, useMemo, useState } from "react"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DashboardHeader } from "@/components/dashboard-header"
import { LatestSDH } from "@/components/latest-sdh"
import { SectionCards } from "@/components/section-cards"
import {
  getDeploymentMetrics,
  listDeployments,
  listSDH,
  type DeploymentDashboard,
  type MetricSample,
  type SDHItem,
} from "@/lib/dashboard-client"

export default function DashboardPage() {
  const [deployments, setDeployments] = useState<DeploymentDashboard[]>([])
  const [sdh, setSdh] = useState<SDHItem[]>([])
  const [metrics, setMetrics] = useState<MetricSample[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [deploymentsData, sdhData] = await Promise.all([
          listDeployments(),
          listSDH({ limit: 20 }),
        ])
        if (cancelled) return

        setDeployments(deploymentsData)
        setSdh(sdhData)

        const latestDeployment = deploymentsData
          .filter((deployment) => deployment.state === "analyzed" || deployment.state === "finished")
          .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime())[0]

        if (latestDeployment) {
          const metricsData = await getDeploymentMetrics(latestDeployment.internal_id)
          if (cancelled) return
          setMetrics(metricsData)
        } else {
          setMetrics([])
        }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "Unable to load dashboard."
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const latestSdh = useMemo(() => sdh.slice(0, 8), [sdh])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <DashboardHeader />
      {error ? (
        <div className="px-4 text-sm text-destructive lg:px-6">{error}</div>
      ) : null}
      <SectionCards deployments={deployments} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive deployments={deployments} metrics={metrics} />
      </div>
      <div className="px-4 lg:px-6">
        <LatestSDH data={latestSdh} />
      </div>
      {loading ? <div className="px-4 text-sm text-muted-foreground lg:px-6">Loading dashboard...</div> : null}
    </div>
  )
}
