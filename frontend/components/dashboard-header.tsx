"use client"

import { useEffect, useState } from "react"
import { IconPlus } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/store/use-settings-store"
import { useTranslation } from "@/components/providers/i18n-provider"

function getGreetingKey(): string {
  const hour = new Date().getHours()

  if (hour >= 5 && hour < 12) {
    return "dashboard.greeting.morning"
  } else if (hour >= 12 && hour < 18) {
    return "dashboard.greeting.afternoon"
  } else if (hour >= 18 && hour < 22) {
    return "dashboard.greeting.evening"
  } else {
    return "dashboard.greeting.night"
  }
}

function getFormattedTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

const localeMap: Record<string, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
}

function getFormattedDate(language: string): string {
  const locale = localeMap[language] || "en-US"
  return new Date().toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function DashboardHeader() {
  const username = useSettingsStore((state) => state.username)
  const language = useSettingsStore((state) => state.language)
  const { t } = useTranslation()
  const [greeting, setGreeting] = useState<string>("")
  const [currentDate, setCurrentDate] = useState<string>("")
  const [currentTime, setCurrentTime] = useState<string>("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const greetingKey = getGreetingKey()
    setGreeting(t(greetingKey))
    setCurrentDate(getFormattedDate(language))
    setCurrentTime(getFormattedTime())

    // Update time every minute
    const interval = setInterval(() => {
      const greetingKey = getGreetingKey()
      setGreeting(t(greetingKey))
      setCurrentDate(getFormattedDate(language))
      setCurrentTime(getFormattedTime())
    }, 60000)

    return () => clearInterval(interval)
  }, [language, t])

  if (!mounted) {
    return (
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="space-y-1">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {greeting}, {username} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {currentDate} • {currentTime}
        </p>
      </div>
      <Button size="default" className="w-full sm:w-auto">
        <IconPlus />
        {t("dashboard.newProject")}
      </Button>
    </div>
  )
}