"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { fetchCurrentUserFromSession } from "@/lib/auth-client"
import { useSettingsStore } from "@/store/use-settings-store"

type OAuthCallbackData = {
  error: string | null
}

function readOAuthCallbackHash(): OAuthCallbackData {
  if (typeof window === "undefined") {
    return { error: "Invalid OAuth callback context." }
  }

  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash
  const params = new URLSearchParams(fragment)

  return {
    error: params.get("error"),
  }
}

export default function OAuthCallbackPage() {
  const router = useRouter()
  const setUsername = useSettingsStore((state) => state.setUsername)
  const setEmail = useSettingsStore((state) => state.setEmail)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const completeOAuthLogin = async () => {
      const { error: callbackError } = readOAuthCallbackHash()

      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/auth/oauth-callback")
      }

      if (callbackError) {
        setError(callbackError)
        return
      }

      try {
        const user = await fetchCurrentUserFromSession()
        setUsername(user.name)
        setEmail(user.email)
        router.replace("/dashboard")
      } catch {
        setError("Unable to finish OAuth login. Please try again.")
      }
    }

    void completeOAuthLogin()
  }, [router, setEmail, setUsername])

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold">OAuth authentication</h1>
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              className="mt-3 rounded-xl bg-foreground px-3.5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
              onClick={() => router.replace("/auth")}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Finalizing your login...</p>
        )}
      </div>
    </div>
  )
}
