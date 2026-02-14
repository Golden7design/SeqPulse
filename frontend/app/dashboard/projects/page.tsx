"use client"

import Link from "next/link"
import { IconCircleCheckFilled, IconAlertTriangle, IconRotateClockwise2, IconShieldCheck, IconShieldX, IconPlus } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/i18n-provider"
import { useEffect, useState } from "react"
import { listProjects, type ProjectDashboard } from "@/lib/dashboard-client"
import { projectNameToPathSegment } from "@/lib/deployment-format"

type Project = ProjectDashboard

function getVerdictIcon(verdict: string) {
  switch (verdict) {
    case "ok":
      return <IconCircleCheckFilled className="size-4 text-green-500" />
    case "warning":
      return <IconAlertTriangle className="size-4 text-orange-500" />
    case "rollback_recommended":
      return <IconRotateClockwise2 className="size-4 text-white" />
    default:
      return null
  }
}

function getVerdictLabel(verdict: string) {
  switch (verdict) {
    case "ok":
      return "OK"
    case "warning":
      return "Warning"
    case "rollback_recommended":
      return "Rollback Recommended"
    default:
      return verdict
  }
}

function getVerdictVariant(verdict: string): "default" | "destructive" | "outline" {
  switch (verdict) {
    case "ok":
      return "outline"
    case "warning":
      return "outline"
    case "rollback_recommended":
      return "destructive"
    default:
      return "outline"
  }
}

function getEnvVariant(env: string): "default" | "secondary" | "outline" {
  switch (env) {
    case "prod":
      return "default"
    case "staging":
      return "secondary"
    case "dev":
      return "outline"
    default:
      return "outline"
  }
}

function getPlanVariant(plan: string): "default" | "secondary" | "outline" {
  switch (plan) {
    case "enterprise":
      return "default"
    case "pro":
      return "secondary"
    case "free":
      return "outline"
    default:
      return "outline"
  }
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / 60000)
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) return "just now"
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`
  if (diffInHours < 24) return `${diffInHours}h ago`
  return `${diffInDays}d ago`
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/dashboard/projects/${projectNameToPathSegment(project.name)}`}>
      <Card className="transition-all hover:border-primary hover:shadow-md cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2">{project.name}</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={getEnvVariant(project.env)} className="capitalize">
                  {project.env}
                </Badge>
                <Badge variant={getPlanVariant(project.plan)} className="capitalize">
                  {project.plan}
                </Badge>
                {project.hmac_enabled ? (
                  <Badge variant="outline" className="gap-1">
                    <IconShieldCheck className="size-3" />
                    HMAC
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <IconShieldX className="size-3" />
                    No HMAC
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tech Stack */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Tech Stack</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {project.stack.map((tech, index) => (
                <Badge key={index} variant="secondary" className="text-xs font-mono">
                  {tech}
                </Badge>
              ))}
            </div>
          </div>

          {/* Last Deployment */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Last Deployment</p>
            <div className="flex items-center gap-2">
              <Badge variant={getVerdictVariant(project.last_deployment.verdict)} className="gap-1.5">
                {getVerdictIcon(project.last_deployment.verdict)}
                {getVerdictLabel(project.last_deployment.verdict)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {getTimeAgo(project.last_deployment.finished_at)}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground w-full">
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground">{project.stats.deployments_total}</span>
              <span>deployments</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium text-green-500">{project.stats.ok_count}</span>
              <span>OK</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium text-orange-500">{project.stats.warning_count}</span>
              <span>warning</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium text-destructive">{project.stats.rollback_count}</span>
              <span>rollback</span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const data = await listProjects()
        if (cancelled) return
        setProjects(data)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "Unable to load projects."
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 px-4 sm:flex-row w-full sm:items-center sm:justify-between lg:px-6" >

        <div>
        <h1 className="text-2xl font-bold">{t("projects.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("projects.description")}
        </p>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

        </div>
        <Link href="/dashboard/projects/new">
          <Button size="default" className="w-full sm:w-auto">
                <IconPlus />
                {t("dashboard.newProject")}
              </Button>
        </Link>
      </div>

            

      {/* Projects Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading projects...</p> : null}

      {projects.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No projects available</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
