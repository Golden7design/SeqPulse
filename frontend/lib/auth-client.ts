"use client"

import {
  apiBaseUrl,
  clearStoredAuthToken,
  getStoredAuthToken,
  requestJson,
  saveStoredAuthToken,
} from "@/lib/api-client"

export type AuthUser = {
  name: string
  email: string
  has_password?: boolean
}

export type LoginPayload = {
  email: string
  password: string
}

export type SignupPayload = {
  name: string
  email: string
  password: string
}

export type UpdateProfilePayload = {
  name: string
}

export type ChangePasswordPayload = {
  current_password: string
  new_password: string
}

export type SetPasswordPayload = {
  new_password: string
}

export type OAuthProvider = "github" | "google"
export type OAuthMode = "login" | "signup"

type LoginResponse = {
  access_token: string
  token_type: string
}

type MessageResponse = {
  message: string
}

function toErrorMessage(status: number, detail?: string): string {
  if (detail && detail.trim().length > 0) {
    return detail
  }
  if (status === 401) {
    return "Invalid email or password."
  }
  if (status === 409) {
    return "Email already used."
  }
  return "Request failed. Please try again."
}

function toSessionErrorMessage(status: number, detail?: string): string {
  if (detail && detail.trim().length > 0) {
    return detail
  }
  if (status === 401) {
    return "Session expired. Please login again."
  }
  return "Request failed. Please try again."
}

export async function signupUser(payload: SignupPayload): Promise<AuthUser> {
  return requestJson<AuthUser>(
    "/auth/signup",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { mapError: toErrorMessage }
  )
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  return requestJson<LoginResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { mapError: toErrorMessage }
  )
}

export async function fetchCurrentUser(token?: string): Promise<AuthUser> {
  return requestJson<AuthUser>(
    "/auth/me",
    {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
    { auth: true, mapError: toSessionErrorMessage }
  )
}

export async function fetchCurrentUserFromSession(): Promise<AuthUser> {
  return requestJson<AuthUser>(
    "/auth/me",
    { method: "GET" },
    { auth: true, mapError: toSessionErrorMessage }
  )
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
  return requestJson<AuthUser>(
    "/auth/me",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    { auth: true, mapError: toSessionErrorMessage }
  )
}

export async function changePassword(payload: ChangePasswordPayload): Promise<MessageResponse> {
  return requestJson<MessageResponse>(
    "/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true, mapError: toSessionErrorMessage }
  )
}

export async function setPassword(payload: SetPasswordPayload): Promise<MessageResponse> {
  return requestJson<MessageResponse>(
    "/auth/set-password",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true, mapError: toSessionErrorMessage }
  )
}

export async function logoutUser(): Promise<MessageResponse> {
  return requestJson<MessageResponse>(
    "/auth/logout",
    {
      method: "POST",
    },
    { mapError: toSessionErrorMessage }
  )
}

export function saveAuthToken(token: string): void {
  saveStoredAuthToken(token)
}

export function getAuthToken(): string | null {
  return getStoredAuthToken()
}

export function clearAuthToken(): void {
  clearStoredAuthToken()
}

function buildOAuthStartUrl(provider: OAuthProvider, mode: OAuthMode): string {
  const params = new URLSearchParams({ mode })
  return `${apiBaseUrl()}/auth/oauth/${provider}/start?${params.toString()}`
}

export function startOAuth(provider: OAuthProvider, mode: OAuthMode): void {
  if (typeof window === "undefined") return
  window.location.assign(buildOAuthStartUrl(provider, mode))
}
