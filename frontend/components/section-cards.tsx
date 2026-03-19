import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"
import Link from "next/link"
import { useState, useEffect } from "react"

import { useTranslation } from "@/components/providers/i18n-provider"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DeploymentDashboard } from "@/lib/dashboard-client"
import { deploymentNumberToDisplay } from "@/lib/deployment-format"

type StatType = "ok" | "warning" | "rollback"
type BadgeMode = "percent" | "new" | "resumed"
type Translator = (key: string) => string

interface StatData {
  current: number
  previous: number
  change_pct: number | null
  badge_mode: BadgeMode
}

function getBackgroundColor(type: StatType, change: number | null, badgeMode: BadgeMode): string {
  if (badgeMode === "new") return "bg-blue-500/10 dark:bg-blue-500/20"
  if (badgeMode === "resumed") return "bg-cyan-500/10 dark:bg-cyan-500/20"
  if (change === null || change === 0) return "bg-muted"

  const isPositive = change > 0

  switch (type) {
    case "ok":
      return isPositive
        ? "bg-green-500/10 dark:bg-green-500/20"
        : "bg-orange-500/10 dark:bg-orange-500/20"
    case "warning":
      return isPositive
        ? "bg-orange-500/10 dark:bg-orange-500/20"
        : "bg-green-500/10 dark:bg-green-500/20"
    case "rollback":
      return isPositive
        ? "bg-red-500/10 dark:bg-red-500/20"
        : "bg-green-500/10 dark:bg-green-500/20"
  }
}

function getBadgeColor(type: StatType, change: number | null, badgeMode: BadgeMode): string {
  if (badgeMode === "new") return "text-blue-600 dark:text-blue-400"
  if (badgeMode === "resumed") return "text-cyan-600 dark:text-cyan-400"
  if (change === null || change === 0) return "text-muted-foreground"

  const isPositive = change > 0

  switch (type) {
    case "ok":
      return isPositive
        ? "text-green-600 dark:text-green-400"
        : "text-orange-600 dark:text-orange-400"
    case "warning":
      return isPositive
        ? "text-orange-600 dark:text-orange-400"
        : "text-green-600 dark:text-green-400"
    case "rollback":
      return isPositive
        ? "text-red-600 dark:text-red-400"
        : "text-green-600 dark:text-green-400"
  }
}

function resolveStatType(deployment: DeploymentDashboard): StatType {
  if (deployment.verdict.verdict === "rollback_recommended") return "rollback"
  if (deployment.verdict.verdict === "warning") return "warning"
  return "ok"
}

function computeStatData(
  deployments: DeploymentDashboard[],
  type: StatType,
  nowMs: number
): StatData {
  const dayMs = 24 * 60 * 60 * 1000
  const currentStart = nowMs - 7 * dayMs
  const previousStart = nowMs - 14 * dayMs

  let current = 0
  let previous = 0
  let olderHistory = 0

  for (const deployment of deployments) {
    if (deployment.state !== "analyzed") continue
    if (resolveStatType(deployment) !== type) continue
    const finishedAtMs = new Date(deployment.finished_at).getTime()
    if (Number.isNaN(finishedAtMs)) continue

    if (finishedAtMs >= currentStart && finishedAtMs <= nowMs) {
      current += 1
    } else if (finishedAtMs >= previousStart && finishedAtMs < currentStart) {
      previous += 1
    } else if (finishedAtMs < previousStart) {
      olderHistory += 1
    }
  }

  let badge_mode: BadgeMode = "percent"
  let change_pct: number | null = 0

  if (previous > 0) {
    change_pct = Number((((current - previous) / previous) * 100).toFixed(1))
  } else if (current > 0 && olderHistory > 0) {
    badge_mode = "resumed"
    change_pct = null
  } else if (current > 0) {
    badge_mode = "new"
    change_pct = null
  }

  return {
    current,
    previous,
    change_pct,
    badge_mode,
  }
}

function getLiveStateLabel(state: DeploymentDashboard["state"], t: Translator): string {
  switch (state) {
    case "pending":
      return t("dashboard.sectionCards.live.state.pending")
    case "running":
      return t("dashboard.sectionCards.live.state.running")
    case "finished":
      return t("dashboard.sectionCards.live.state.finished")
    case "analyzed":
      return t("dashboard.sectionCards.live.state.analyzed")
    default:
      return t("dashboard.sectionCards.live.state.unknown")
  }
}

function getLiveStateHint(state: DeploymentDashboard["state"], t: Translator): string {
  switch (state) {
    case "pending":
      return t("dashboard.sectionCards.live.hint.pending")
    case "running":
      return t("dashboard.sectionCards.live.hint.running")
    case "finished":
      return t("dashboard.sectionCards.live.hint.finished")
    case "analyzed":
      return t("dashboard.sectionCards.live.hint.analyzed")
    default:
      return t("dashboard.sectionCards.live.hint.unknown")
  }
}

export function SectionCards({
  deployments,
  liveDeployment,
}: {
  deployments: DeploymentDashboard[]
  liveDeployment: DeploymentDashboard | null
}) {
  const { t } = useTranslation()

  // Keep a client-only clock to avoid hydration mismatch and keep
  // the 7-day windows sliding even when no new deployments arrive.
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    setNowMs(Date.now())

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 60_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    // Recompute immediately when deployment data changes (in addition to the clock tick).
    setNowMs(Date.now())
  }, [deployments])

  const stats = {
    ok: computeStatData(deployments, "ok", nowMs),
    warning: computeStatData(deployments, "warning", nowMs),
    rollback: computeStatData(deployments, "rollback", nowMs),
  }

  const cards = [
    { type: "ok" as StatType, title: t("dashboard.sectionCards.titles.ok"), data: stats.ok },
    { type: "warning" as StatType, title: t("dashboard.sectionCards.titles.warning"), data: stats.warning },
    { type: "rollback" as StatType, title: t("dashboard.sectionCards.titles.rollback"), data: stats.rollback },
  ]

  return (
    <div
      className={
        liveDeployment
          ? "grid grid-cols-1 items-stretch gap-4 px-4 lg:px-6 md:grid-cols-2 xl:grid-cols-4"
          : "grid grid-cols-1 items-stretch gap-4 px-4 lg:px-6 md:grid-cols-2 xl:grid-cols-3"
      }
    >
      {cards.map((card) => {
        const changePct = card.data.change_pct
        const badgeMode = card.data.badge_mode
        const isPositive = changePct !== null && changePct > 0
        const isNew = badgeMode === "new"
        const isResumed = badgeMode === "resumed"
        const showArrow = badgeMode === "percent" && changePct !== null && changePct !== 0

        const verdictParam = card.type === "rollback" ? "rollback_recommended" : card.type

        return (
          <Link
            key={card.type}
            href={`/dashboard/deployments?verdict=${verdictParam}`}
            className="block h-full transition-transform hover:scale-[1.02]"
          >
            <Card className="@container/card h-full cursor-pointer">
              <CardHeader>
                <CardDescription>{card.title}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {card.data.current}
                </CardTitle>
                <CardAction>
                  <Badge
                    variant="outline"
                    className={`${getBackgroundColor(card.type, changePct, badgeMode)} ${getBadgeColor(card.type, changePct, badgeMode)} border-0 font-mono`}
                  >
                    {(showArrow || isResumed) && (isPositive || isResumed ? <IconTrendingUp /> : <IconTrendingDown />)}
                    {isNew
                      ? t("dashboard.sectionCards.badges.new")
                      : isResumed
                        ? t("dashboard.sectionCards.badges.resumed")
                        : `${isPositive ? "+" : ""}${changePct}%`}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex min-h-14 flex-col items-start gap-1.5 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium">{t("dashboard.sectionCards.period.last7Days")}</div>
                <div className="text-muted-foreground">{t("dashboard.sectionCards.period.comparedPrevious7Days")}</div>
              </CardFooter>
            </Card>
          </Link>
        )
      })}
      {liveDeployment && (
        <Card className="@container/card h-full border-blue-200/80 bg-blue-100/50 dark:border-blue-900/60 dark:bg-blue-950/20">
          <CardHeader>
            <CardDescription>{t("dashboard.sectionCards.live.title")}</CardDescription>
            <CardTitle className="font-mono text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {deploymentNumberToDisplay(liveDeployment.deployment_number)}
            </CardTitle>
            <CardAction>
              <Badge
                variant="outline"
                className="border-0 bg-blue-500/10 font-mono text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
              >
                {(liveDeployment.state === "pending" || liveDeployment.state === "running") && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {getLiveStateLabel(liveDeployment.state, t)}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex min-h-14 flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">{getLiveStateHint(liveDeployment.state, t)}</div>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}