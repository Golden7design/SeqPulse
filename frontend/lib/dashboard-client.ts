"use client"

import { requestJson } from "@/lib/api-client"

export type DeploymentDashboard = {
  id: string
  internal_id: string
  public_id: string
  deployment_number: number
  project: string
  env: string
  pipeline_result: "success" | "failed" | null
  verdict: {
    verdict: "ok" | "warning" | "rollback_recommended"
    confidence: number
    summary: string
    details: string[]
  }
  state: "pending" | "running" | "finished" | "analyzed"
  started_at: string
  finished_at: string
  duration_ms: number
}

export type ProjectDashboard = {
  id: string
  internal_id: string
  project_number: number
  name: string
  env: string
  plan: "free" | "pro" | "enterprise"
  hmac_enabled: boolean
  stack: string[]
  last_deployment: {
    id: string
    deployment_number: number
    verdict: "ok" | "warning" | "rollback_recommended"
    finished_at: string
  }
  stats: {
    deployments_total: number
    ok_count: number
    warning_count: number
    rollback_count: number
  }
  created_at: string
}

export type MetricSample = {
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

export type SDHItem = {
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

function mapError(status: number, detail?: string): string {
  if (detail) return detail
  if (status === 401) return "Session expired. Please login again."
  return "Unable to load dashboard data."
}

export function listProjects(): Promise<ProjectDashboard[]> {
  return requestJson<ProjectDashboard[]>(
    "/projects/",
    { method: "GET" },
    { auth: true, mapError }
  )
}

export function getProject(projectId: string): Promise<ProjectDashboard> {
  return requestJson<ProjectDashboard>(
    `/projects/${encodeURIComponent(projectId)}`,
    { method: "GET" },
    { auth: true, mapError }
  )
}

export function listDeployments(projectId?: string): Promise<DeploymentDashboard[]> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""
  return requestJson<DeploymentDashboard[]>(
    `/deployments/${query}`,
    { method: "GET" },
    { auth: true, mapError }
  )
}

export function getDeployment(deploymentId: string): Promise<DeploymentDashboard> {
  return requestJson<DeploymentDashboard>(
    `/deployments/${encodeURIComponent(deploymentId)}`,
    { method: "GET" },
    { auth: true, mapError }
  )
}

export function getDeploymentMetrics(deploymentId: string): Promise<MetricSample[]> {
  return requestJson<MetricSample[]>(
    `/deployments/${encodeURIComponent(deploymentId)}/metrics`,
    { method: "GET" },
    { auth: true, mapError }
  )
}

export function listSDH(params?: {
  limit?: number
  project_id?: string
  deployment_id?: string
  severity?: "critical" | "warning" | "info"
}): Promise<SDHItem[]> {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set("limit", String(params.limit))
  if (params?.project_id) searchParams.set("project_id", params.project_id)
  if (params?.deployment_id) searchParams.set("deployment_id", params.deployment_id)
  if (params?.severity) searchParams.set("severity", params.severity)
  const query = searchParams.toString()
  return requestJson<SDHItem[]>(
    `/sdh/${query ? `?${query}` : ""}`,
    { method: "GET" },
    { auth: true, mapError }
  )
}
