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

function getVerdictBadgeClasses(type: StatType, change: number | null): string {
  const isPositive = change !== null && change > 0
  const isNew = change === null

  if (isNew) {
    return "border-0 font-mono bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
  }

  const baseClasses = "border-0 font-mono transition-all duration-300"

  switch (type) {
    case "ok":
      return isPositive
        ? `${baseClasses} bg-green-500/10 text-green-600 hover:bg-green-500/15 dark:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/25`
        : `${baseClasses} bg-orange-500/10 text-orange-600 hover:bg-orange-500/15 dark:bg-orange-500/20 dark:text-orange-400 dark:hover:bg-orange-500/25`
    case "warning":
      return isPositive
        ? `${baseClasses} bg-orange-500/10 text-orange-600 hover:bg-orange-500/15 dark:bg-orange-500/20 dark:text-orange-400 dark:hover:bg-orange-500/25`
        : `${baseClasses} bg-green-500/10 text-green-600 hover:bg-green-500/15 dark:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/25`
    case "rollback":
      return isPositive
        ? `${baseClasses} bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/25`
        : `${baseClasses} bg-green-500/10 text-green-600 hover:bg-green-500/15 dark:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/25`
  }
}

function getCardHoverBorder(type: StatType): string {
  switch (type) {
    case "ok":
      return "group-hover:border-green-500/30 dark:group-hover:border-green-500/40"
    case "warning":
      return "group-hover:border-orange-500/30 dark:group-hover:border-orange-500/40"
    case "rollback":
      return "group-hover:border-red-500/30 dark:group-hover:border-red-500/40"
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
    if (deployment.state !== "analyzed") continue
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

function getLiveStateLabel(state: DeploymentDashboard["state"]): string {
  switch (state) {
    case "pending":
      return "pending"
    case "running":
      return "running"
    case "finished":
      return "finished"
    case "analyzed":
      return "analyzed"
    default:
      return state
  }
}

function getLiveStateHint(state: DeploymentDashboard["state"]): string {
  switch (state) {
    case "pending":
      return "Queued before execution"
    case "running":
      return "Deployment currently running"
    case "finished":
      return "Post-deploy checks in progress"
    case "analyzed":
      return "Analysis completed"
    default:
      return "Status unavailable"
  }
}

export function SectionCards({
  deployments,
  liveDeployment,
}: {
  deployments: DeploymentDashboard[]
  liveDeployment: DeploymentDashboard | null
}) {
  const nowMsFromAnalyzed = deployments.reduce((maxTs, deployment) => {
    if (deployment.state !== "analyzed") return maxTs
    const ts = new Date(deployment.finished_at).getTime()
    if (Number.isNaN(ts)) return maxTs
    return Math.max(maxTs, ts)
  }, 0)
  const nowMs = nowMsFromAnalyzed > 0 ? nowMsFromAnalyzed : Date.now()
  const stats = {
    ok: computeStatData(deployments, "ok", nowMs),
    warning: computeStatData(deployments, "warning", nowMs),
    rollback: computeStatData(deployments, "rollback", nowMs),
  }

  const cards = [
    { type: "ok" as StatType, title: "Deployment OK", data: stats.ok },
    { type: "warning" as StatType, title: "Deployment Warning", data: stats.warning },
    { type: "rollback" as StatType, title: "Rollback Recommended", data: stats.rollback },
  ]

  return (
    <div
      className={
        liveDeployment
          ? "grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4"
          : "grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3"
      }
    >
      {cards.map((card) => {
        const changePct = card.data.change_pct
        const isPositive = changePct !== null && changePct > 0
        const isNew = changePct === null

        const verdictParam = card.type === "rollback" ? "rollback_recommended" : card.type

        return (
          <Link key={card.type} href={`/dashboard/deployments?verdict=${verdictParam}`} className="block">
            <Card
              className={`group @container/card cursor-pointer transition-all duration-300 border-border/60 hover:border-border ${getCardHoverBorder(
                card.type
              )} hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20`}
            >
              <CardHeader>
                <CardDescription className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
                  {card.title}
                </CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {card.data.current}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline" className={getVerdictBadgeClasses(card.type, changePct)}>
                    {!isNew && (isPositive ? <IconTrendingUp className="w-3.5 h-3.5" /> : <IconTrendingDown className="w-3.5 h-3.5" />)}
                    {isNew ? "New" : `${isPositive ? "+" : ""}${changePct}%`}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 text-sm pb-4">
                <div className="line-clamp-1 flex gap-2 font-medium">Last 7 Days</div>
                <div className="text-muted-foreground text-xs">Compared to previous 7 days</div>
              </CardFooter>
            </Card>
          </Link>
        )
      })}
      {liveDeployment && (
        <Card className="@container/card group cursor-pointer transition-all duration-300 border-blue-200/80 bg-blue-100/50 hover:bg-blue-100/70 hover:border-blue-300 dark:border-blue-900/60 dark:bg-blue-950/20 dark:hover:bg-blue-950/30 dark:hover:border-blue-900/70 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20">
          <CardHeader>
            <CardDescription className="text-blue-600 dark:text-blue-400 text-xs uppercase tracking-wider font-medium">
              Deployment Status (Live)
            </CardDescription>
            <CardTitle className="font-mono text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {deploymentNumberToDisplay(liveDeployment.deployment_number)}
            </CardTitle>
            <CardAction>
              <Badge
                variant="outline"
                className="border-0 bg-blue-500/10 font-mono text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500/15 dark:hover:bg-blue-500/25 transition-all duration-300"
              >
                {(liveDeployment.state === "pending" || liveDeployment.state === "running") && (
                  <span className="mr-1.5 h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent status-badge live" />
                )}
                {getLiveStateLabel(liveDeployment.state)}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm pb-4">
            <div className="line-clamp-1 flex gap-2 font-medium">{getLiveStateHint(liveDeployment.state)}</div>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}