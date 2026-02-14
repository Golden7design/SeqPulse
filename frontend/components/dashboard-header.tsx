"use client"

import { useEffect, useState } from "react"
import { IconPlus } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/store/use-settings-store"
import { useTranslation } from "@/components/providers/i18n-provider"
import Link from "next/dist/client/link"


function getGreetingKey(date: Date): string {
  const hour = date.getHours()

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

function getFormattedTime(date: Date): string {
  return date.toLocaleTimeString([], {
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
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const greeting = t(getGreetingKey(now))
  const currentDate = getFormattedDate(language)
  const currentTime = getFormattedTime(now)

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
        <Link href="/dashboard/projects/new">
          <Button size="default" className="w-full sm:w-auto">
                <IconPlus />
                {t("dashboard.newProject")}
              </Button>
        </Link>
    </div>
  )
}
