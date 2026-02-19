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
  access_token: string | null
  token_type: string
  requires_2fa: boolean
  challenge_id: string | null
  challenge_expires_at: string | null
}

type MessageResponse = {
  message: string
}

export type TwoFAChallengeVerifyPayload = {
  code: string
  challenge_id?: string
  use_recovery_code?: boolean
}

export type TwoFAChallengeSessionResponse = {
  requires_2fa: boolean
  challenge_id: string | null
  challenge_expires_at: string | null
}

export type TwoFAStatusResponse = {
  enabled: boolean
  has_setup_secret: boolean
  recovery_codes_remaining: number
}

export type TwoFASetupStartResponse = {
  secret: string
  otpauth_uri: string
  issuer: string
  digits: number
  period: number
}

export type TwoFASetupVerifyPayload = {
  code: string
}

export type TwoFARecoveryCodePayload = {
  code: string
  use_recovery_code?: boolean
}

export type TwoFARecoveryCodesResponse = {
  message: string
  recovery_codes: string[]
  recovery_codes_remaining: number
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

function toTwoFAErrorMessage(status: number, detail?: string): string {
  if (detail && detail.trim().length > 0) {
    return detail
  }
  if (status === 400) {
    return "Invalid two-factor code."
  }
  if (status === 401) {
    return "2FA session expired. Restart login."
  }
  if (status === 404) {
    return "2FA challenge not found. Restart login."
  }
  if (status === 429) {
    return "Too many attempts. Please wait and retry."
  }
  return "Unable to process 2FA request. Please try again."
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

export async function verifyTwoFAChallenge(
  payload: TwoFAChallengeVerifyPayload
): Promise<MessageResponse> {
  return requestJson<MessageResponse>(
    "/auth/2fa/challenge/verify",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { mapError: toTwoFAErrorMessage }
  )
}

export async function fetchTwoFAChallengeSession(): Promise<TwoFAChallengeSessionResponse> {
  return requestJson<TwoFAChallengeSessionResponse>(
    "/auth/2fa/challenge/session",
    { method: "GET" },
    { mapError: toTwoFAErrorMessage }
  )
}

export async function fetchTwoFAStatus(): Promise<TwoFAStatusResponse> {
  return requestJson<TwoFAStatusResponse>(
    "/auth/2fa/status",
    { method: "GET" },
    { auth: true, mapError: toSessionErrorMessage }
  )
}

export async function startTwoFASetup(): Promise<TwoFASetupStartResponse> {
  return requestJson<TwoFASetupStartResponse>(
    "/auth/2fa/setup/start",
    { method: "POST" },
    { auth: true, mapError: toTwoFAErrorMessage }
  )
}

export async function verifyTwoFASetup(
  payload: TwoFASetupVerifyPayload
): Promise<TwoFARecoveryCodesResponse> {
  return requestJson<TwoFARecoveryCodesResponse>(
    "/auth/2fa/setup/verify",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true, mapError: toTwoFAErrorMessage }
  )
}

export async function disableTwoFA(
  payload: TwoFARecoveryCodePayload
): Promise<MessageResponse> {
  return requestJson<MessageResponse>(
    "/auth/2fa/disable",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true, mapError: toTwoFAErrorMessage }
  )
}

export async function regenerateTwoFARecoveryCodes(
  payload: TwoFARecoveryCodePayload
): Promise<TwoFARecoveryCodesResponse> {
  return requestJson<TwoFARecoveryCodesResponse>(
    "/auth/2fa/recovery-codes/regenerate",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true, mapError: toTwoFAErrorMessage }
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
