"use client"

import { requestJson } from "@/lib/api-client"

export type CreateProjectPayload = {
  name: string
  description?: string
  tech_stack?: string
  envs: string[]
  metrics_endpoint: string
  plan: "free" | "pro" | "enterprise"
}

export type NewProjectDraft = {
  name: string
  description?: string
  tech_stack?: string
  envs: string[]
  metrics_endpoint: string
}

export const NEW_PROJECT_DRAFT_STORAGE_KEY = "seqpulse_new_project_draft_v1"

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

export type ProjectEndpointConfig = {
  state: "pending_verification" | "active" | "blocked"
  candidate_endpoint: string | null
  active_endpoint: string | null
  candidate_endpoint_masked: string | null
  active_endpoint_masked: string | null
  host_lock: string | null
  changes_used: number
  changes_limit: number | null
  migrations_used: number
  migrations_limit: number | null
  last_verified_at: string | null
  last_test_error_code: string | null
  baseline_version: number
}

export type UpdateProjectEndpointPayload = {
  metrics_endpoint: string
}

export type DeleteProjectPayload = {
  confirmation_name: string
}

export type DeleteProjectResult = {
  id: string
  name: string
  status: "deleted"
}

export function saveNewProjectDraft(draft: NewProjectDraft): void {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(NEW_PROJECT_DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

export function readNewProjectDraft(): NewProjectDraft | null {
  if (typeof window === "undefined") return null
  const raw = window.sessionStorage.getItem(NEW_PROJECT_DRAFT_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as NewProjectDraft
    if (
      typeof parsed.name !== "string" ||
      !Array.isArray(parsed.envs) ||
      typeof parsed.metrics_endpoint !== "string"
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearNewProjectDraft(): void {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(NEW_PROJECT_DRAFT_STORAGE_KEY)
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

function toEndpointErrorMessage(status: number, detail?: string): string {
  if (detail) {
    const businessErrors: Record<string, string> = {
      ENDPOINT_INVALID_FORMAT: "Metrics endpoint invalid format.",
      ENDPOINT_TEST_FAILED: "Endpoint test failed. Verify URL and endpoint response payload.",
      PROJECT_ENDPOINT_BLOCKED: "Project endpoint is blocked.",
      ENDPOINT_MISMATCH: "Deployment endpoint does not match active project endpoint.",
      CHANGE_LIMIT_EXCEEDED: "Path change quota exceeded for this project plan.",
      MIGRATION_LIMIT_EXCEEDED: "Host migration quota exceeded for this project plan.",
      HOST_LOCK_VIOLATION: "Host lock violation.",
      REAUTH_REQUIRED: "Re-authentication required for this action.",
      INSUFFICIENT_ROLE: "Insufficient permissions for this action.",
    }
    return businessErrors[detail] ?? detail
  }
  if (status === 401) return "Session expired. Please login again."
  if (status === 403) return "Insufficient permissions for this action."
  return "Endpoint action failed."
}

function toProjectDeleteErrorMessage(status: number, detail?: string): string {
  if (detail) {
    const businessErrors: Record<string, string> = {
      PROJECT_DELETE_CONFIRMATION_MISMATCH: "Project name confirmation does not match.",
      REAUTH_REQUIRED: "Re-authentication required for this action.",
      INSUFFICIENT_ROLE: "Insufficient permissions for this action.",
    }
    return businessErrors[detail] ?? detail
  }
  if (status === 401) return "Session expired. Please login again."
  if (status === 403) return "Insufficient permissions for this action."
  if (status === 404) return "Project not found."
  return "Project deletion failed."
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

export async function getProjectEndpoint(projectId: string): Promise<ProjectEndpointConfig> {
  return requestJson<ProjectEndpointConfig>(
    `/projects/${encodeURIComponent(projectId)}/endpoint`,
    { method: "GET" },
    { auth: true, mapError: toEndpointErrorMessage }
  )
}

export async function updateProjectEndpoint(
  projectId: string,
  payload: UpdateProjectEndpointPayload
): Promise<ProjectEndpointConfig> {
  return requestJson<ProjectEndpointConfig>(
    `/projects/${encodeURIComponent(projectId)}/endpoint`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { auth: true, mapError: toEndpointErrorMessage }
  )
}

export async function testProjectEndpoint(projectId: string): Promise<ProjectEndpointConfig> {
  return requestJson<ProjectEndpointConfig>(
    `/projects/${encodeURIComponent(projectId)}/endpoint/test`,
    { method: "POST" },
    { auth: true, mapError: toEndpointErrorMessage }
  )
}

export async function deleteProject(
  projectId: string,
  payload: DeleteProjectPayload
): Promise<DeleteProjectResult> {
  return requestJson<DeleteProjectResult>(
    `/projects/${encodeURIComponent(projectId)}`,
    {
      method: "DELETE",
      body: JSON.stringify(payload),
    },
    { auth: true, mapError: toProjectDeleteErrorMessage }
  )
}
