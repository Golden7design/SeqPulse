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

export type SDH = {
  id: string
  deployment_id: string
  project: string
  env: string
  severity: "critical" | "warning" | "info"
  metric: string
  observed_value: number | null
  threshold: number | null
  confidence?: number
  title: string
  diagnosis: string
  suggested_actions: string[]
  created_at: string
}

function getTimeAgo(dateString: string, t: (key: string) => string): string {
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
  switch (severity) {
    case "critical":
      return <IconAlertTriangle className="size-4 text-destructive" />
    case "warning":
      return <IconAlertTriangle className="size-4 text-orange-500" />
    case "info":
      return <IconInfoCircle className="size-4 text-blue-500" />
  }
}

function SDHItem({ sdh, t }: { sdh: SDH; t: (key: string) => string }) {
  return (
    <Link 
      href="/dashboard/SDH"
      className="flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-accent/50"
    >
      <div className="mt-0.5">
        <SeverityIcon severity={sdh.severity} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight line-clamp-2">
            {sdh.title}
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{sdh.project}</span>
          <span>•</span>
          <span>{getTimeAgo(sdh.created_at, t)}</span>
        </div>
      </div>
    </Link>
  )
}

export function LatestSDH({ data }: { data: SDH[] }) {
  const latestSDH = data.slice(0, 4)
  const { t } = useTranslation()

  return (
    <Card>
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
            <IconCircleCheckFilled className="size-12 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {t("dashboard.LatestSDH.NoDiagnostics")}
            </p>
          </div>
        ) : (
          latestSDH.map((sdh) => (
            <SDHItem key={sdh.id} sdh={sdh} t={t} />
          ))
        )}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button variant="ghost" size="sm" asChild className="w-full">
          <Link href="/dashboard/SDH">
            {t("dashboard.LatestSDH.viewAllDiag")} →
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
