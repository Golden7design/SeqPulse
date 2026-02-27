"use client"

import { useEffect, useMemo, useState } from "react"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DashboardHeader } from "@/components/dashboard-header"
import { LatestSDH } from "@/components/latest-sdh"
import { DashboardPageSkeleton } from "@/components/page-skeletons"
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
  const [metricsDeploymentId, setMetricsDeploymentId] = useState<string | null>(null)
  const [metricsDeploymentState, setMetricsDeploymentState] = useState<DeploymentDashboard["state"] | null>(null)
  const [trackedLiveDeploymentId, setTrackedLiveDeploymentId] = useState<string | null>(null)
  const [trackedAnalyzedVisibleUntil, setTrackedAnalyzedVisibleUntil] = useState<number | null>(null)
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
          setMetricsDeploymentId(latestDeployment.internal_id)
          setMetricsDeploymentState(latestDeployment.state)
        } else {
          setMetrics([])
          setMetricsDeploymentId(null)
          setMetricsDeploymentState(null)
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

  useEffect(() => {
    let cancelled = false

    const pollDeployments = async () => {
      try {
        const deploymentsData = await listDeployments()
        if (cancelled) return
        setDeployments(deploymentsData)
      } catch {
        // Keep latest available dashboard state on transient polling errors.
      }
    }

    const intervalId = window.setInterval(() => {
      void pollDeployments()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const syncMetricsWithLatestDeployment = async () => {
      const latestDeployment = deployments
        .filter((deployment) => deployment.state === "analyzed" || deployment.state === "finished")
        .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime())[0]

      if (!latestDeployment) {
        setMetrics([])
        setMetricsDeploymentId(null)
        setMetricsDeploymentState(null)
        return
      }

      const isSameDeployment = metricsDeploymentId === latestDeployment.internal_id
      const didStateChange = metricsDeploymentState !== latestDeployment.state
      const hasPostMetrics = metrics.some((sample) => sample.phase === "post")
      const needsPostMetricsRefresh =
        isSameDeployment && latestDeployment.state === "analyzed" && !hasPostMetrics

      if (isSameDeployment && !didStateChange && !needsPostMetricsRefresh) {
        return
      }

      try {
        const metricsData = await getDeploymentMetrics(latestDeployment.internal_id)
        if (cancelled) return
        setMetrics(metricsData)
        setMetricsDeploymentId(latestDeployment.internal_id)
        setMetricsDeploymentState(latestDeployment.state)
      } catch {
        // Keep previous chart data if metrics fetch fails.
      }
    }

    void syncMetricsWithLatestDeployment()

    return () => {
      cancelled = true
    }
  }, [deployments, metrics, metricsDeploymentId, metricsDeploymentState])

  const inProgressDeployment = useMemo(() => {
    return deployments
      .filter((deployment) =>
        deployment.state === "pending" || deployment.state === "running" || deployment.state === "finished"
      )
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0] ?? null
  }, [deployments])

  useEffect(() => {
    if (inProgressDeployment) {
      if (trackedLiveDeploymentId !== inProgressDeployment.id) {
        setTrackedLiveDeploymentId(inProgressDeployment.id)
      }
      if (trackedAnalyzedVisibleUntil !== null) {
        setTrackedAnalyzedVisibleUntil(null)
      }
      return
    }

    if (!trackedLiveDeploymentId) return

    const trackedDeployment = deployments.find((deployment) => deployment.id === trackedLiveDeploymentId)
    if (trackedDeployment?.state === "analyzed") {
      if (trackedAnalyzedVisibleUntil === null) {
        setTrackedAnalyzedVisibleUntil(Date.now() + 15000)
      }
      return
    }

    setTrackedLiveDeploymentId(null)
    setTrackedAnalyzedVisibleUntil(null)
  }, [inProgressDeployment, deployments, trackedLiveDeploymentId, trackedAnalyzedVisibleUntil])

  useEffect(() => {
    if (trackedAnalyzedVisibleUntil === null) return

    const remainingMs = trackedAnalyzedVisibleUntil - Date.now()
    if (remainingMs <= 0) {
      setTrackedLiveDeploymentId(null)
      setTrackedAnalyzedVisibleUntil(null)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setTrackedLiveDeploymentId(null)
      setTrackedAnalyzedVisibleUntil(null)
    }, remainingMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [trackedAnalyzedVisibleUntil])

  const liveDeployment = useMemo(() => {
    if (inProgressDeployment) return inProgressDeployment
    if (!trackedLiveDeploymentId || trackedAnalyzedVisibleUntil === null) return null
    if (Date.now() > trackedAnalyzedVisibleUntil) return null
    const trackedDeployment = deployments.find((deployment) => deployment.id === trackedLiveDeploymentId)
    return trackedDeployment?.state === "analyzed" ? trackedDeployment : null
  }, [inProgressDeployment, deployments, trackedLiveDeploymentId, trackedAnalyzedVisibleUntil])

  const latestSdh = useMemo(() => sdh.slice(0, 8), [sdh])

  if (loading) {
    return <DashboardPageSkeleton />
  }

  return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <DashboardHeader />
        {error ? (
          <div className="px-4 text-sm text-destructive lg:px-6">{error}</div>
        ) : null}
        <SectionCards deployments={deployments} liveDeployment={liveDeployment} />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive deployments={deployments} metrics={metrics} />
        </div>
        <div className="px-4 lg:px-6">
          <LatestSDH data={latestSdh} />
        </div>
      </div>
  )
}
