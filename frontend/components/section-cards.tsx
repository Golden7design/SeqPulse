import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"
import Link from "next/link"

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

interface StatData {
  current: number
  previous: number
  change_pct: number | null
}

function getBackgroundColor(type: StatType, change: number | null): string {
  if (change === null) return "bg-blue-500/10 dark:bg-blue-500/20"

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

function getBadgeColor(type: StatType, change: number | null): string {
  if (change === null) return "text-blue-600 dark:text-blue-400"

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

  for (const deployment of deployments) {
    if (resolveStatType(deployment) !== type) continue
    const finishedAtMs = new Date(deployment.finished_at).getTime()
    if (Number.isNaN(finishedAtMs)) continue

    if (finishedAtMs >= currentStart && finishedAtMs <= nowMs) {
      current += 1
    } else if (finishedAtMs >= previousStart && finishedAtMs < currentStart) {
      previous += 1
    }
  }

  const change_pct =
    previous === 0 ? (current === 0 ? 0 : null) : Number((((current - previous) / previous) * 100).toFixed(1))

  return {
    current,
    previous,
    change_pct,
  }
}

export function SectionCards({ deployments }: { deployments: DeploymentDashboard[] }) {
  const nowMs = deployments.reduce((maxTs, deployment) => {
    const ts = new Date(deployment.finished_at).getTime()
    if (Number.isNaN(ts)) return maxTs
    return Math.max(maxTs, ts)
  }, 0)
  const stats = {
    ok: computeStatData(deployments, "ok", nowMs),
    warning: computeStatData(deployments, "warning", nowMs),
    rollback: computeStatData(deployments, "rollback", nowMs),
  }

  const inProgressDeployment = deployments
    .filter((deployment) => deployment.state === "running" || deployment.state === "pending")
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]

  const cards = [
    { type: "ok" as StatType, title: "Deployment OK", data: stats.ok },
    { type: "warning" as StatType, title: "Deployment Warning", data: stats.warning },
    { type: "rollback" as StatType, title: "Rollback Recommended", data: stats.rollback },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => {
        const changePct = card.data.change_pct
        const isPositive = changePct !== null && changePct > 0
        const isNew = changePct === null

        const verdictParam = card.type === "rollback" ? "rollback_recommended" : card.type

        return (
          <Link
            key={card.type}
            href={`/dashboard/deployments?verdict=${verdictParam}`}
            className="block transition-transform hover:scale-[1.02]"
          >
            <Card className="@container/card cursor-pointer">
              <CardHeader>
                <CardDescription>{card.title}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {card.data.current}
                </CardTitle>
                <CardAction>
                  <Badge
                    variant="outline"
                    className={`${getBackgroundColor(card.type, changePct)} ${getBadgeColor(card.type, changePct)} border-0 font-mono`}
                  >
                    {!isNew && (isPositive ? <IconTrendingUp /> : <IconTrendingDown />)}
                    {isNew ? "New" : `${isPositive ? "+" : ""}${changePct}%`}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium">Last 7 Days</div>
                <div className="text-muted-foreground">Compared to previous 7 days</div>
              </CardFooter>
            </Card>
          </Link>
        )
      })}
      <Card className="@container/card border-blue-200/80 bg-blue-100/50 dark:border-blue-900/60 dark:bg-blue-950/20">
        <CardHeader>
          <CardDescription>Deployments en cours</CardDescription>
          <CardTitle className="font-mono text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {inProgressDeployment ? deploymentNumberToDisplay(inProgressDeployment.deployment_number) : "-"}
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className="border-0 bg-blue-500/10 font-mono text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
            >
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {inProgressDeployment?.state ?? "idle"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">{/*Statut en temps reel*/}</div>
        </CardFooter>
      </Card>
    </div>
  )
}
