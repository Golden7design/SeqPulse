"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { FullPageLoader } from "@/components/loading-spinner"
import {
  clearAuthToken,
  fetchCurrentUserFromSession,
  fetchTwoFAStatus,
} from "@/lib/auth-client"
import { useSettingsStore } from "@/store/use-settings-store"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const setUsername = useSettingsStore((state) => state.setUsername)
  const setEmail = useSettingsStore((state) => state.setEmail)
  const setTwoFactorEnabled = useSettingsStore((state) => state.setTwoFactorEnabled)

  useEffect(() => {
    let cancelled = false

    const checkSession = async () => {
      try {
        const me = await fetchCurrentUserFromSession()
        if (cancelled) return
        setUsername(me.name)
        setEmail(me.email)
        try {
          const twoFaStatus = await fetchTwoFAStatus()
          if (!cancelled) {
            setTwoFactorEnabled(twoFaStatus.enabled)
          }
        } catch {
          // Keep dashboard accessible even if 2FA status fetch fails.
        }
        setReady(true)
      } catch {
        clearAuthToken()
        if (cancelled) return
        router.replace("/auth")
      }
    }

    void checkSession()

    return () => {
      cancelled = true
    }
  }, [router, setEmail, setTwoFactorEnabled, setUsername])

  if (!ready) {
    return <FullPageLoader />
  }

  return <>{children}</>
}
