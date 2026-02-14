"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { FullPageLoader } from "@/components/loading-spinner"
import { clearAuthToken, fetchCurrentUser, getAuthToken } from "@/lib/auth-client"
import { useSettingsStore } from "@/store/use-settings-store"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const setUsername = useSettingsStore((state) => state.setUsername)
  const setEmail = useSettingsStore((state) => state.setEmail)

  useEffect(() => {
    let cancelled = false

    const checkSession = async () => {
      const token = getAuthToken()
      if (!token) {
        router.replace("/auth")
        return
      }

      try {
        const me = await fetchCurrentUser(token)
        if (cancelled) return
        setUsername(me.name)
        setEmail(me.email)
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
  }, [router, setEmail, setUsername])

  if (!ready) {
    return <FullPageLoader />
  }

  return <>{children}</>
}
