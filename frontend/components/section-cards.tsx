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

// Import mock data
import statsData from "@/app/dashboard/deployment-stats.json"

type StatType = "ok" | "warning" | "rollback"

interface StatData {
  current: number
  previous: number
  change_pct: number | null
}

interface DeploymentStats {
  period: string
  comparison_period: string
  stats: {
    ok: StatData
    warning: StatData
    rollback: StatData
  }
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

function formatPeriod(period: string): string {
  return period.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
}

export function SectionCards() {
  const data = statsData as DeploymentStats
  const inProgressDeployment = {
    deploymentNumber: "dpl_009",
    status: "running",
  }

  const cards = [
    { type: "ok" as StatType, title: "Deployment OK", data: data.stats.ok },
    { type: "warning" as StatType, title: "Deployment Warning", data: data.stats.warning },
    { type: "rollback" as StatType, title: "Rollback Recommended", data: data.stats.rollback },
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
                <div className="line-clamp-1 flex gap-2 font-medium">
                  {formatPeriod(data.period)}
                </div>
                <div className="text-muted-foreground">
                  Compared to {formatPeriod(data.comparison_period)}
                </div>
              </CardFooter>
            </Card>
          </Link>
        )
      })}
      <Card className="@container/card border-blue-200/60 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20">
        <CardHeader>
          <CardDescription>Deployments en cours</CardDescription>
          <CardTitle className="font-mono text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {inProgressDeployment.deploymentNumber}
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className="border-0 bg-blue-500/10 font-mono text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
            >
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {inProgressDeployment.status}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">Statut en temps reel</div>
        </CardFooter>
      </Card>
    </div>
  )
}
