"use client"

import { requestJson } from "@/lib/api-client"

export type CreateProjectPayload = {
  name: string
  description?: string
  tech_stack?: string
  envs: string[]
}

export type ProjectPublic = {
  id: string
  internal_id: string
  project_number: number
  name: string
  description?: string | null
  tech_stack?: string | null
  api_key: string
  envs: string[]
  hmac_enabled: boolean
}

export type ProjectHmacSecret = {
  hmac_secret: string
}

export type ProjectSlackConfig = {
  enabled: boolean
  webhook_url_configured: boolean
  webhook_url_preview: string | null
  channel: string | null
  plan: "free" | "pro" | "enterprise"
}

export type ProjectObservationWindowConfig = {
  observation_window_minutes: 5 | 15
  editable: boolean
  plan: "free" | "pro" | "enterprise"
}

export type UpdateProjectObservationWindowPayload = {
  observation_window_minutes: 5 | 15
}

export type UpdateProjectSlackPayload = {
  enabled: boolean
  webhook_url?: string
  channel?: string
}

export type ProjectSlackTestResult = {
  status: string
  reason?: string | null
}

function toErrorMessage(status: number, detail?: string): string {
  if (detail && detail.trim().length > 0) {
    return detail
  }
  if (status === 401) {
    return "Session expired. Please login again."
  }
  if (status === 422) {
    return "Invalid project data."
  }
  return "Project creation failed. Please try again."
}

export async function createProject(payload: CreateProjectPayload): Promise<ProjectPublic> {
  return requestJson<ProjectPublic>(
    "/projects/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true, mapError: toErrorMessage }
  )
}

export async function getProjectPublic(projectId: string): Promise<ProjectPublic> {
  return requestJson<ProjectPublic>(
    `/projects/${encodeURIComponent(projectId)}/public`,
    { method: "GET" },
    { auth: true, mapError: toErrorMessage }
  )
}

export async function enableProjectHmac(projectId: string): Promise<ProjectHmacSecret> {
  return requestJson<ProjectHmacSecret>(
    `/projects/${encodeURIComponent(projectId)}/hmac/enable`,
    { method: "POST" },
    { auth: true, mapError: toErrorMessage }
  )
}

export async function disableProjectHmac(projectId: string): Promise<ProjectPublic> {
  return requestJson<ProjectPublic>(
    `/projects/${encodeURIComponent(projectId)}/hmac/disable`,
    { method: "POST" },
    { auth: true, mapError: toErrorMessage }
  )
}

export async function rotateProjectHmac(projectId: string): Promise<ProjectHmacSecret> {
  return requestJson<ProjectHmacSecret>(
    `/projects/${encodeURIComponent(projectId)}/hmac/rotate`,
    { method: "POST" },
    { auth: true, mapError: toErrorMessage }
  )
}

export async function getProjectSlackConfig(projectId: string): Promise<ProjectSlackConfig> {
  return requestJson<ProjectSlackConfig>(
    `/projects/${encodeURIComponent(projectId)}/slack`,
    { method: "GET" },
    { auth: true, mapError: toErrorMessage }
  )
}

export async function getProjectObservationWindow(
  projectId: string
): Promise<ProjectObservationWindowConfig> {
  return requestJson<ProjectObservationWindowConfig>(
    `/projects/${encodeURIComponent(projectId)}/observation-window`,
    { method: "GET" },
    { auth: true, mapError: toErrorMessage }
  )
}

export async function updateProjectObservationWindow(
  projectId: string,
  payload: UpdateProjectObservationWindowPayload
): Promise<ProjectObservationWindowConfig> {
  return requestJson<ProjectObservationWindowConfig>(
    `/projects/${encodeURIComponent(projectId)}/observation-window`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { auth: true, mapError: toErrorMessage }
  )
}

export async function updateProjectSlackConfig(
  projectId: string,
  payload: UpdateProjectSlackPayload
): Promise<ProjectSlackConfig> {
  return requestJson<ProjectSlackConfig>(
    `/projects/${encodeURIComponent(projectId)}/slack`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { auth: true, mapError: toErrorMessage }
  )
}

export async function sendProjectSlackTestMessage(
  projectId: string,
  message?: string
): Promise<ProjectSlackTestResult> {
  return requestJson<ProjectSlackTestResult>(
    `/projects/${encodeURIComponent(projectId)}/slack/test`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    },
    { auth: true, mapError: toErrorMessage }
  )
}
