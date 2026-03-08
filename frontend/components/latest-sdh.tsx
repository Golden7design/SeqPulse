"use client"

import { IconAlertTriangle, IconCircleCheckFilled, IconInfoCircle } from "@tabler/icons-react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTranslation } from "./providers/i18n-provider"
import { resolveLocalizedText, type LocalizedText } from "@/lib/localized-text"

export type SDH = {
  id: string
  deployment_id: string
  project: string
  env: string
  severity: "critical" | "warning" | "info"
  metric: string
  observed_value: number | null
  threshold: number | null
  secured_threshold?: number | null
  exceed_ratio?: number | null
  tolerance?: number | null
  confidence?: number
  title: string
  title_i18n?: LocalizedText | null
  diagnosis: string
  suggested_actions: string[]
  created_at: string
}

function getTimeAgo(
  dateString: string,
  t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string
): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / 60000)
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) return t("common.justNow")
  if (diffInMinutes < 60) return `${diffInMinutes}${t("common.minutesAgoShort")}`
  if (diffInHours < 24) return `${diffInHours}${t("common.hoursAgoShort")}`
  return `${diffInDays}${t("common.daysAgoShort")}`
}

function SeverityIcon({ severity }: { severity: SDH["severity"] }) {
  const iconClass = "size-4 transition-transform group-hover:scale-110"

  switch (severity) {
    case "critical":
      return <IconAlertTriangle className={`${iconClass} text-red-500 dark:text-red-400`} />
    case "warning":
      return <IconAlertTriangle className={`${iconClass} text-orange-500 dark:text-orange-400`} />
    case "info":
      return <IconInfoCircle className={`${iconClass} text-blue-500 dark:text-blue-400`} />
  }
}

function getSeverityBadgeClasses(severity: SDH["severity"]): string {
  const base = "border-0 font-medium transition-all duration-300"

  switch (severity) {
    case "critical":
      return `${base} bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/15 dark:hover:bg-red-500/25`
    case "warning":
      return `${base} bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 hover:bg-orange-500/15 dark:hover:bg-orange-500/25`
    case "info":
      return `${base} bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500/15 dark:hover:bg-blue-500/25`
  }
}

function SDHItem({
  sdh,
  t,
}: {
  sdh: SDH
  t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string
}) {
  const localizedTitle = resolveLocalizedText(sdh.title_i18n, t, sdh.title)

  return (
    <Link
      href="/dashboard/SDH"
      className="group flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-all duration-300 hover:border-border/60 hover:bg-accent/50"
    >
      <div className="mt-0.5 flex-shrink-0">
        <SeverityIcon severity={sdh.severity} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-foreground transition-colors">
            {localizedTitle}
          </p>
          <Badge variant="outline" className={getSeverityBadgeClasses(sdh.severity)}>
            {sdh.severity}
          </Badge>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{sdh.project}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span>{getTimeAgo(sdh.created_at, t)}</span>
        </div>
        {sdh.metric && (
          <div className="mt-1.5 text-xs text-muted-foreground font-mono">
            {sdh.metric}
          </div>
        )}
      </div>
    </Link>
  )
}

export function LatestSDH({ data }: { data: SDH[] }) {
  const latestSDH = data.slice(0, 4)
  const { t } = useTranslation()

  return (
    <Card className="transition-all duration-300 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{t("dashboard.LatestSDH.title")}</span>
          <Badge variant="secondary" className="text-xs">
            {t("dashboard.LatestSDH.badge")}
          </Badge>
        </CardTitle>
        <CardDescription>
          {t("dashboard.LatestSDH.RecentDiagRecommendation")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {latestSDH.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-green-500/10 p-3 mb-3 dark:bg-green-500/20">
              <IconCircleCheckFilled className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.LatestSDH.NoDiagnostics")}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              No issues detected in recent deployments
            </p>
          </div>
        ) : (
          latestSDH.map((sdh) => (
            <SDHItem key={sdh.id} sdh={sdh} t={t} />
          ))
        )}
      </CardContent>
      <CardFooter className="border-t bg-muted/30 pt-4">
        <Button variant="ghost" size="sm" asChild className="w-full transition-all duration-300 hover:bg-accent">
          <Link href="/dashboard/SDH">
            {t("dashboard.LatestSDH.viewAllDiag")} →
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
