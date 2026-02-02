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

type StatType = "ok" | "attention" | "rollback"

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
    attention: StatData
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
    case "attention":
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
    case "attention":
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

  const cards = [
    { type: "ok" as StatType, title: "Deployment OK", data: data.stats.ok },
    { type: "attention" as StatType, title: "Deployment Attention", data: data.stats.attention },
    { type: "rollback" as StatType, title: "Rollback Recommended", data: data.stats.rollback },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
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
    </div>
  )
}