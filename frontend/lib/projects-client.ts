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
