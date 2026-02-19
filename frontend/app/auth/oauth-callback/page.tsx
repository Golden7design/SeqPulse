"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { useTranslation } from "@/components/providers/i18n-provider"
import {
  fetchTwoFAChallengeSession,
  fetchCurrentUser,
  fetchCurrentUserFromSession,
  saveAuthToken,
} from "@/lib/auth-client"
import { useSettingsStore } from "@/store/use-settings-store"

type OAuthCallbackData = {
  error: string | null
  requires2fa: boolean
  challengeId: string | null
  challengeExpiresAt: string | null
  accessToken: string | null
}

const OAUTH_FINISH_ERROR_KEY = "auth.errors.oauthFinishFailed"

function readOAuthCallbackHash(): OAuthCallbackData {
  if (typeof window === "undefined") {
    return {
      error: "auth.errors.oauthInvalidContext",
      requires2fa: false,
      challengeId: null,
      challengeExpiresAt: null,
      accessToken: null,
    }
  }

  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash
  const hashParams = new URLSearchParams(fragment)
  const queryParams = new URLSearchParams(window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search)

  const readParam = (key: string): string | null => {
    const fromHash = hashParams.get(key)
    if (fromHash !== null && fromHash !== "") return fromHash
    const fromQuery = queryParams.get(key)
    if (fromQuery !== null && fromQuery !== "") return fromQuery
    return null
  }

  return {
    error: readParam("error"),
    requires2fa: readParam("requires_2fa") === "1",
    challengeId: readParam("challenge_id"),
    challengeExpiresAt: readParam("challenge_expires_at"),
    accessToken: readParam("access_token"),
  }
}

async function waitForOAuthSession(
  accessToken: string | null,
  maxAttempts = 4,
  delayMs = 250
) {
  if (accessToken) {
    try {
      return await fetchCurrentUser(accessToken)
    } catch {
      // Fall back to cookie/session path below.
    }
  }

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchCurrentUserFromSession()
    } catch (err) {
      lastError =
        err instanceof Error ? err : new Error(OAUTH_FINISH_ERROR_KEY)
      if (attempt === maxAttempts) break
      await new Promise((resolve) => window.setTimeout(resolve, delayMs))
    }
  }
  throw lastError ?? new Error(OAUTH_FINISH_ERROR_KEY)
}

export default function OAuthCallbackPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const setUsername = useSettingsStore((state) => state.setUsername)
  const setEmail = useSettingsStore((state) => state.setEmail)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const completeOAuthLogin = async () => {
      const {
        error: callbackError,
        requires2fa,
        challengeId,
        challengeExpiresAt,
        accessToken,
      } =
        readOAuthCallbackHash()

      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/auth/oauth-callback")
      }

      if (callbackError) {
        setError(callbackError.startsWith("auth.") ? t(callbackError) : callbackError)
        return
      }

      if (requires2fa) {
        if (!challengeId) {
          setError(t("auth.errors.twofaChallengeMissingRetry"))
          return
        }
        const params = new URLSearchParams({ challenge_id: challengeId })
        if (challengeExpiresAt) {
          params.set("expires_at", challengeExpiresAt)
        }
        router.replace(`/auth/2fa-challenge?${params.toString()}`)
        return
      }

      if (!accessToken) {
        try {
          const fallbackChallenge = await fetchTwoFAChallengeSession()
          if (fallbackChallenge.requires_2fa && fallbackChallenge.challenge_id) {
            const params = new URLSearchParams({
              challenge_id: fallbackChallenge.challenge_id,
            })
            if (fallbackChallenge.challenge_expires_at) {
              params.set("expires_at", fallbackChallenge.challenge_expires_at)
            }
            router.replace(`/auth/2fa-challenge?${params.toString()}`)
            return
          }
        } catch {
          // Ignore fallback lookup failure and continue with normal session resolution.
        }
      }

      if (accessToken) {
        saveAuthToken(accessToken)
      }

      try {
        const user = await waitForOAuthSession(accessToken)
        setUsername(user.name)
        setEmail(user.email)
        router.replace("/dashboard")
      } catch (err) {
        const message =
          err instanceof Error ? err.message : OAUTH_FINISH_ERROR_KEY
        setError(message.startsWith("auth.") ? t(message) : message)
      }
    }

    void completeOAuthLogin()
  }, [router, setEmail, setUsername, t])

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold">{t("auth.oauth.title")}</h1>
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              className="mt-3 rounded-xl bg-foreground px-3.5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
              onClick={() => router.replace("/auth")}
            >
              {t("auth.common.backToSignIn")}
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("auth.oauth.finalizing")}</p>
        )}
      </div>
    </div>
  )
}
