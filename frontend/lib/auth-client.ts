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

type LoginResponse = {
  access_token: string
  token_type: string
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

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch(`${apiBaseUrl()}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error("Invalid or expired session.")
  }

  return (await response.json()) as AuthUser
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
