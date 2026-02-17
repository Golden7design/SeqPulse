"use client"

type ErrorDetailItem = {
  msg?: string
}

type ErrorBody = {
  detail?: string | ErrorDetailItem[]
}

export const AUTH_TOKEN_KEY = "seqpulse_auth_token"

export function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL
  if (configured && configured.trim().length > 0) {
    if (typeof window !== "undefined") {
      const currentHost = window.location.hostname
      const isCurrentHostLocal = currentHost === "localhost" || currentHost === "127.0.0.1"
      try {
        const parsed = new URL(configured)
        const isConfiguredLocal =
          parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
        if (isConfiguredLocal && !isCurrentHostLocal) {
          const port = parsed.port || "8000"
          return `${parsed.protocol}//${currentHost}:${port}`.replace(/\/+$/, "")
        }
      } catch {
        // Keep configured value if URL parsing fails.
      }
    }
    return configured.replace(/\/+$/, "")
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:8000`
  }

  return "http://localhost:8000"
}

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function saveStoredAuthToken(token: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearStoredAuthToken(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

function extractDetail(body: ErrorBody | null): string | undefined {
  const detail = body?.detail
  if (!detail) return undefined
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join(", ")
  }
  return detail
}

export async function requestJson<T>(
  path: string,
  init: RequestInit,
  options?: {
    auth?: boolean
    mapError?: (status: number, detail?: string) => string
  }
): Promise<T> {
  const authEnabled = options?.auth ?? false
  const token = authEnabled ? getStoredAuthToken() : null

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    credentials: init.credentials ?? "include",
    headers: {
      "Content-Type": "application/json",
      ...(authEnabled && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null
    const detail = extractDetail(body)
    if (options?.mapError) {
      throw new Error(options.mapError(response.status, detail))
    }
    throw new Error(detail || "Request failed.")
  }

  return (await response.json()) as T
}
