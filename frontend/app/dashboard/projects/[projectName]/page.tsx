"use client"

import { use, useState, useEffect, useRef, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { 
  IconShieldCheck, 
  IconShieldX, 
  IconCircleCheckFilled, 
  IconAlertTriangle, 
  IconRotateClockwise2,
  IconInfoCircle,
  IconChevronRight,
  IconCopy,
  IconCheck,
  IconKey,
  IconShield,
  IconClock,
  IconAlertTriangleFilled,
  IconTrash,
  IconCode
} from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import {
  projectNameToPathSegment,
  publicDeploymentIdToDisplay,
} from "@/lib/deployment-format"
import {
  getProject,
  listDeployments,
  listProjects,
  listSDH,
  type DeploymentDashboard,
  type ProjectDashboard,
  type SDHItem,
} from "@/lib/dashboard-client"
import {
  disableProjectHmac,
  enableProjectHmac,
  getProjectPublic,
  rotateProjectHmac,
} from "@/lib/projects-client"

type Project = ProjectDashboard
type Deployment = DeploymentDashboard
type SDH = SDHItem

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

function getPipelineResultVariant(result: string | null): "default" | "destructive" | "outline" {
  switch (result) {
    case "success":
      return "outline"
    case "failed":
      return "destructive"
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

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

function formatMetricValue(value: number | null, metric: string): string {
  if (value === null || metric === "composite") {
    return "N/A"
  }
  if (metric.includes("rate") || metric.includes("usage")) {
    return `${(value * 100).toFixed(1)}%`
  }
  if (metric.includes("latency")) {
    return `${value}ms`
  }
  return value.toString()
}

function formatMetricLabel(metric: string): string {
  return metric === "composite" ? "multi-signal" : metric
}

function maskSecret(value: string | null | undefined): string {
  if (!value) return ""
  return "*".repeat(value.length)
}

function SeverityBadge({ severity }: { severity: SDH["severity"] }) {
  const variants = {
    critical: "destructive",
    warning: "outline",
    info: "secondary",
  } as const

  return (
    <Badge variant={variants[severity]} className="gap-1.5">
      {severity === "critical" && <IconAlertTriangle className="size-5" />}
      {severity === "warning" && <IconAlertTriangle className="size-3" />}
      {severity === "info" && <IconInfoCircle className="size-3" />}
      <span className="capitalize">{severity}</span>
    </Badge>
  )
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

function SDHDetailCard({ sdh }: { sdh: SDH }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <SeverityBadge severity={sdh.severity} />
              <Badge variant="outline" className="font-mono text-xs">
                {sdh.project}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {sdh.env}
              </Badge>
            </div>
            <CardTitle className="text-lg">{sdh.title}</CardTitle>
            <CardDescription className="mt-1">
              {formatDate(sdh.created_at)} • {getTimeAgo(sdh.created_at)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metric Details */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Metric</p>
            <p className="font-mono text-sm font-medium">{formatMetricLabel(sdh.metric)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Observed</p>
            <p className="text-sm font-medium">
              {formatMetricValue(sdh.observed_value, sdh.metric)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Threshold</p>
            <p className="text-sm font-medium">
              {formatMetricValue(sdh.threshold, sdh.metric)}
            </p>
          </div>
        </div>

        {/* Diagnosis */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">Diagnosis</h4>
          <p className="text-sm text-muted-foreground">{sdh.diagnosis}</p>
        </div>

        {/* Suggested Actions */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">Suggested Actions</h4>
          <ul className="space-y-1.5">
            {sdh.suggested_actions.map((action, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <IconChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Deployment</span>
          <span className="font-mono font-medium text-foreground">
            #{sdh.deployment_id.replace("dpl_", "")}
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}

function SDHItem({ sdh }: { sdh: SDH }) {
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
          <span>{getTimeAgo(sdh.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

function CopyButton({ text, label, disabled }: { text: string; label?: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (disabled || !text) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'absolute'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        ta.setSelectionRange(0, ta.value.length)
        const successful = document.execCommand('copy')
        document.body.removeChild(ta)
        if (!successful) throw new Error('copy-failed')
      }

      setCopied(true)
      toast.success(label ? `${label} copied` : "Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
      toast.error("Failed to copy")
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleCopy}
      disabled={disabled}
      className="shrink-0"
    >
      {copied ? (
        <IconCheck className="size-4 text-green-500" />
      ) : (
        <IconCopy className="size-4" />
      )}
    </Button>
  )
}

function classifySnippetToken(token: string, language: "javascript" | "yaml"): string {
  if (token.length === 0) return "text-slate-300"

  if (language === "javascript") {
    if (/^\s*\/\/.*/.test(token)) return "text-slate-500 italic"
    if (/^["'`].*["'`]$/.test(token)) return "text-emerald-300"
    if (/^(?:const|let|var|function|async|await|return|if|else|try|catch|throw|import|from|new|for|of)$/.test(token)) {
      return "text-sky-300"
    }
    if (/^(?:true|false|null|undefined)$/.test(token)) return "text-fuchsia-300"
    if (/^\d+(?:\.\d+)?$/.test(token)) return "text-amber-300"
    if (/^(?:Math|Number|Date|JSON|fetch)$/.test(token)) return "text-violet-300"
    return "text-slate-200"
  }

  if (/^\s*#/.test(token)) return "text-slate-500 italic"
  if (/^["'`].*["'`]$/.test(token)) return "text-emerald-300"
  if (/^\$\{\{.*\}\}$/.test(token) || /^\$\{[A-Z0-9_]+\}$/.test(token)) return "text-fuchsia-300"
  if (/^(?:name|on|jobs|env|steps|uses|run|id|if)$/.test(token)) return "text-sky-300"
  if (/^[A-Z0-9_]+$/.test(token)) return "text-orange-300"
  if (/^(?:curl|jq|echo|set|export)$/.test(token)) return "text-violet-300"
  if (/^[a-zA-Z0-9_-]+:$/.test(token)) return "text-sky-300"
  return "text-slate-200"
}

function renderHighlightedLine(line: string, language: "javascript" | "yaml"): ReactNode[] {
  const tokenPattern =
    language === "javascript"
      ? /(\/\/.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b(?:const|let|var|function|async|await|return|if|else|try|catch|throw|import|from|new|for|of|true|false|null|undefined|Math|Number|Date|JSON|fetch)\b|\b\d+(?:\.\d+)?\b)/g
      : /(#.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\$\{\{[^}]+\}\}|\$\{[A-Z0-9_]+\}|\b(?:name|on|jobs|env|steps|uses|run|id|if)\b|\b(?:curl|jq|echo|set|export)\b|[a-zA-Z0-9_-]+:|[A-Z0-9_]+)/g

  const parts = line.split(tokenPattern).filter((part) => part.length > 0)
  return parts.map((part, index) => (
    <span key={`${part}-${index}`} className={classifySnippetToken(part, language)}>
      {part}
    </span>
  ))
}

function CodeBlock({
  code,
  filename,
  language,
}: {
  code: string
  filename: string
  language: "javascript" | "yaml"
}) {
  const lines = code.split("\n")

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-[#0b1020]">
      <div className="flex items-center justify-between border-b border-slate-700/80 bg-[#121933] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-red-400" />
          <span className="size-2 rounded-full bg-yellow-300" />
          <span className="size-2 rounded-full bg-green-400" />
          <span className="ml-2 font-mono text-xs text-slate-300">{filename}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
            {language}
          </Badge>
          <CopyButton text={code} />
        </div>
      </div>
      <pre className="overflow-x-auto bg-[#0b1020] p-4 text-[12px] leading-6">
        <code className="font-mono">
          {lines.map((line, index) => (
            <div key={`${index}-${line}`} className="flex min-w-max">
              <span className="mr-4 w-8 shrink-0 select-none text-right text-slate-500">
                {index + 1}
              </span>
              <span>{renderHighlightedLine(line, language)}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  )
}

function DeleteProjectDialog({ projectName }: { projectName: string }) {
  const [confirmName, setConfirmName] = useState("")
  const [open, setOpen] = useState(false)

  const handleDelete = () => {
    console.log("Deleting project:", projectName)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full sm:w-auto">
          <IconTrash />
          Delete Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the project and remove all associated data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-semibold text-foreground">{projectName}</span> to confirm deletion:
            </p>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={projectName}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmName !== projectName}
          >
            Delete Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ProjectDetailPage({ params }: { params: Promise<{ projectName: string }> }) {
  const router = useRouter()
  const { projectName: rawProjectName } = use(params)
  const projectSegment = decodeURIComponent(rawProjectName)
  const searchParams = useSearchParams()
  const defaultTab = searchParams?.get("tab") || "overview"

  const [project, setProject] = useState<Project | null>(null)
  const [projectId, setProjectId] = useState("")
  const [projectDeployments, setProjectDeployments] = useState<Deployment[]>([])
  const [projectSDH, setProjectSDH] = useState<SDH[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [hmacEnabled, setHmacEnabled] = useState(false)
  const [apiKeyRaw, setApiKeyRaw] = useState<string>("")
  const [hmacSecretOneShotRaw, setHmacSecretOneShotRaw] = useState<string>("")
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [hmacLoading, setHmacLoading] = useState(false)
  const [observationWindow, setObservationWindow] = useState("15min")
  const [editEndpointOpen, setEditEndpointOpen] = useState(false)
  const [newEndpoint, setNewEndpoint] = useState("https://billing.example.com/ds-metrics")
  const [baselineReady, setBaselineReady] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadProjectData = async () => {
      setLoading(true)
      setSettingsLoading(true)
      setError(null)

      try {
        const projects = await listProjects()
        if (cancelled) return

        const selectedProject =
          projects.find((item) => projectNameToPathSegment(item.name) === projectSegment) ??
          projects.find((item) => item.id === projectSegment)

        if (!selectedProject) {
          setProject(null)
          setProjectId("")
          setProjectDeployments([])
          setProjectSDH([])
          setApiKeyRaw("")
          setHmacEnabled(false)
          return
        }

        const resolvedProjectId = selectedProject.internal_id || selectedProject.id
        const [projectData, deploymentsData, sdhData, projectPublic] = await Promise.all([
          getProject(resolvedProjectId),
          listDeployments(resolvedProjectId),
          listSDH({ project_id: resolvedProjectId, limit: 200 }),
          getProjectPublic(resolvedProjectId),
        ])
        if (cancelled) return

        setProject(projectData)
        setProjectId(resolvedProjectId)
        setProjectDeployments(deploymentsData)
        setProjectSDH(sdhData)
        setApiKeyRaw(projectPublic.api_key)
        setHmacEnabled(projectPublic.hmac_enabled)
        setHmacSecretOneShotRaw("")

        const canonicalProjectSegment = projectNameToPathSegment(projectData.name)
        if (canonicalProjectSegment !== projectSegment) {
          router.replace(`/dashboard/projects/${canonicalProjectSegment}`)
        }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "Unable to load project."
        setError(message)
        setProject(null)
        setProjectId("")
        setProjectDeployments([])
        setProjectSDH([])
        setApiKeyRaw("")
        setHmacEnabled(false)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setSettingsLoading(false)
        }
      }
    }

    void loadProjectData()
    return () => {
      cancelled = true
    }
  }, [projectSegment, router])

  const tabsScrollRef = useRef<HTMLDivElement | null>(null)
  const [showLeftTabs, setShowLeftTabs] = useState(false)
  const [showRightTabs, setShowRightTabs] = useState(false)

  useEffect(() => {
    const el = tabsScrollRef.current
    if (!el) return

    const update = () => {
      setShowLeftTabs(el.scrollLeft > 6)
      setShowRightTabs(el.scrollWidth - el.clientWidth - el.scrollLeft > 6)
    }

    update()
    el.addEventListener("scroll", update)
    window.addEventListener("resize", update)

    return () => {
      el.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [projectSDH.length])

  if (loading && !project) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Loading project...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">{error ?? "Project not found"}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const canEditEndpoint = project.plan === "pro" || project.plan === "enterprise"

  const apiKeyMasked = maskSecret(apiKeyRaw) || "*".repeat(32)
  const hmacSecretMasked = maskSecret(hmacSecretOneShotRaw)

  const handleHmacToggle = async () => {
    if (hmacLoading || !projectId) return
    setHmacLoading(true)
    try {
      if (hmacEnabled) {
        const updated = await disableProjectHmac(projectId)
        setHmacEnabled(updated.hmac_enabled)
        setApiKeyRaw(updated.api_key)
        setHmacSecretOneShotRaw("")
        toast.success("HMAC disabled")
      } else {
        const created = await enableProjectHmac(projectId)
        setHmacEnabled(true)
        setHmacSecretOneShotRaw(created.hmac_secret)
        toast.success("HMAC enabled. Secret revealed once.")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "HMAC action failed."
      toast.error(message)
    } finally {
      setHmacLoading(false)
    }
  }

  const handleRotateHmac = async () => {
    if (hmacLoading || !hmacEnabled || !projectId) return
    setHmacLoading(true)
    try {
      const rotated = await rotateProjectHmac(projectId)
      setHmacSecretOneShotRaw(rotated.hmac_secret)
      toast.success("HMAC secret rotated. New secret revealed once.")
    } catch (err) {
      const message = err instanceof Error ? err.message : "HMAC rotation failed."
      toast.error(message)
    } finally {
      setHmacLoading(false)
    }
  }

  const handleSaveEndpoint = () => {
    setBaselineReady(false)
    setEditEndpointOpen(false)
    toast.success("Metrics endpoint updated. Baseline has been reset.")
  }

  const criticalSDH = projectSDH.filter((sdh) => sdh.severity === "critical")
  const warningSDH = projectSDH.filter((sdh) => sdh.severity === "warning")
  const infoSDH = projectSDH.filter((sdh) => sdh.severity === "info")

  const nodeSnippet = `import express from "express"
import os from "node:os"

const app = express()

let totalRequests = 0
let totalErrors = 0
const latencySamples: number[] = []

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint()

  res.on("finish", () => {
    const endedAt = process.hrtime.bigint()
    const latencyMs = Number(endedAt - startedAt) / 1_000_000
    latencySamples.push(latencyMs)
    totalRequests += 1

    if (res.statusCode >= 500) {
      totalErrors += 1
    }
  })

  next()
})

function p95(values: number[]) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(0.95 * (sorted.length - 1))]
}

app.get("/ds-metrics", (_req, res) => {
  const memoryUsage = process.memoryUsage().rss / os.totalmem()
  const cpuUsage = os.loadavg()[0] / os.cpus().length

  // Backend expects this exact shape for metrics collection.
  res.json({
    requests_per_sec: Number((totalRequests / 60).toFixed(2)),
    latency_p95: Number(p95(latencySamples).toFixed(2)),
    error_rate: totalRequests > 0 ? Number((totalErrors / totalRequests).toFixed(4)) : 0,
    cpu_usage: Number(cpuUsage.toFixed(4)),
    memory_usage: Number(memoryUsage.toFixed(4)),
  })

  totalRequests = 0
  totalErrors = 0
  latencySamples.length = 0
})

app.listen(3001, () => {
  console.log("Metrics endpoint ready on :3001/ds-metrics")
})`

  const apiBaseForSnippet = "https://api.seqpulse.io"

  const cicdSnippet = `name: Deploy with SeqPulse

on:
  push:
    branches: ["main"]

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SEQPULSE_API_BASE: "${apiBaseForSnippet}"
      SEQPULSE_API_KEY: "\${{ secrets.SEQPULSE_API_KEY }}"
      SEQPULSE_ENV: "${project.env}"
      SEQPULSE_METRICS_ENDPOINT: "${newEndpoint}"

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Trigger deployment (PRE metrics)
        id: seqpulse_trigger
        run: |
          set -euo pipefail

          RESPONSE=$(curl -sS -X POST "\${SEQPULSE_API_BASE}/deployments/trigger" \\
            -H "X-API-Key: \${SEQPULSE_API_KEY}" \\
            -H "X-Idempotency-Key: \${{ github.run_id }}-\${{ github.run_attempt }}" \\
            -H "Content-Type: application/json" \\
            -d "{
              \\"env\\": \\"\${SEQPULSE_ENV}\\",
              \\"branch\\": \\"\${GITHUB_REF_NAME}\\",
              \\"metrics_endpoint\\": \\"\${SEQPULSE_METRICS_ENDPOINT}\\"
            }")

          echo "Trigger response: \${RESPONSE}"
          DEPLOYMENT_ID=$(echo "\${RESPONSE}" | jq -r ".deployment_id // empty")

          if [ -z "\${DEPLOYMENT_ID}" ]; then
            echo "No deployment_id returned by /deployments/trigger"
            exit 1
          fi

          echo "deployment_id=\${DEPLOYMENT_ID}" >> "\${GITHUB_OUTPUT}"

      - name: Deploy application
        run: |
          echo "Run your real deployment here"

      - name: Finish deployment (POST metrics)
        if: always()
        run: |
          set -euo pipefail
          RESULT="success"
          if [ "\${{ job.status }}" != "success" ]; then
            RESULT="failed"
          fi

          curl -sS -X POST "\${SEQPULSE_API_BASE}/deployments/finish" \\
            -H "X-API-Key: \${SEQPULSE_API_KEY}" \\
            -H "Content-Type: application/json" \\
            -d "{
              \\"deployment_id\\": \\"\${{ steps.seqpulse_trigger.outputs.deployment_id }}\\",
              \\"result\\": \\"\${RESULT}\\",
              \\"metrics_endpoint\\": \\"\${SEQPULSE_METRICS_ENDPOINT}\\"
            }"`

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Top Section - Project Info */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getEnvVariant(project.env)} className="capitalize">
              {project.env}
            </Badge>
            <Badge variant={getPlanVariant(project.plan)} className="capitalize">
              {project.plan}
            </Badge>
            {hmacEnabled ? (
              <Badge variant="outline" className="gap-1">
                <IconShieldCheck className="size-3" />
                HMAC Enabled
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <IconShieldX className="size-3" />
                HMAC Disabled
              </Badge>
            )}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Tech Stack:</span>
          {project.stack.map((tech, index) => (
            <Badge key={index} variant="secondary" className="text-xs font-mono">
              {tech}
            </Badge>
          ))}
        </div>
      </div>

      {/* Tabs */}
<Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full border-b relative">
              <div ref={tabsScrollRef} className="flex gap-2 overflow-x-auto whitespace-nowrap py-2 px-1 -mx-1">
                <TabsTrigger className="flex-shrink-0" value="overview">Overview</TabsTrigger>
                <TabsTrigger className="flex-shrink-0" value="deployments">
                  <span className="inline-flex items-center gap-2">
                    <span>Deployments</span>
                    {projectDeployments.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {projectDeployments.length}
                      </Badge>
                    )}
                  </span>
                </TabsTrigger>
                <TabsTrigger className="flex-shrink-0" value="diagnostics">
                  <span className="inline-flex items-center gap-2">
                    <span>Diagnostics (SDH)</span>
                    {projectSDH.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {projectSDH.length}
                      </Badge>
                    )}
                  </span>
                </TabsTrigger>
                <TabsTrigger className="flex-shrink-0" value="settings">
                  <IconCode className="size-4" />
                  Settings
                </TabsTrigger>
              </div>

              {/* Left / Right scroll indicators */}
              <div className={`pointer-events-none absolute -left-7 top-0 bottom-0 flex items-center pl-2 transition-opacity ${showLeftTabs ? 'opacity-100' : 'opacity-0'}`}>
                <div className="bg-gradient-to-r from-base-100/90 to-transparent rounded-full p-1">
                  <svg className="w-4 h-4 text-black dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </div>
              </div>

              <div className={`pointer-events-none absolute -right-7 top-0 bottom-0 flex items-center pr-2 transition-opacity ${showRightTabs ? 'opacity-100' : 'opacity-0'}`}>
                <div className="bg-gradient-to-l from-base-100/90 to-transparent rounded-full p-1">
                  <svg className="w-4 h-4 text-black dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </div>
            </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Deployments</CardDescription>
                <CardTitle className="text-3xl">
                  {project.stats.deployments_total}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Successful</CardDescription>
                <CardTitle className="text-3xl text-green-500">
                  {project.stats.ok_count}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Warnings</CardDescription>
                <CardTitle className="text-3xl text-orange-500">
                  {project.stats.warning_count}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Rollbacks</CardDescription>
                <CardTitle className="text-3xl text-destructive">
                  {project.stats.rollback_count}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Last Deployment */}
          <Card>
            <CardHeader>
              <CardTitle>Last Deployment</CardTitle>
              <CardDescription>Most recent deployment information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Deployment ID</p>
                  <p className="font-mono text-sm">{publicDeploymentIdToDisplay(project.last_deployment.id)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Verdict</p>
                  <Badge variant={getVerdictVariant(project.last_deployment.verdict)} className="gap-1.5">
                    {getVerdictIcon(project.last_deployment.verdict)}
                    {getVerdictLabel(project.last_deployment.verdict)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Finished At</p>
                  <p className="text-sm">
                    {new Date(project.last_deployment.finished_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Details */}
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>General information about this project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Project ID</p>
                  <p className="font-mono text-sm">{project.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Environment</p>
                  <p className="text-sm capitalize">{project.env}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Plan</p>
                  <p className="text-sm capitalize">{project.plan}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Created At</p>
                  <p className="text-sm">
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deployments Tab */}
        <TabsContent value="deployments" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Deployments for {project.name}</CardTitle>
              <CardDescription>All deployments for this project</CardDescription>
            </CardHeader>
            <CardContent>
              {projectDeployments.length > 0 ? (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead>Deployment ID</TableHead>
                        <TableHead>Environment</TableHead>
                        <TableHead>Pipeline</TableHead>
                        <TableHead>Verdict</TableHead>
                        <TableHead>Started At</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectDeployments.map((deployment) => (
                        <TableRow key={deployment.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-mono text-sm font-medium">
                            {publicDeploymentIdToDisplay(deployment.id)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getEnvVariant(deployment.env)} className="capitalize">
                              {deployment.env}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getPipelineResultVariant(deployment.pipeline_result)} className="capitalize">
                              {deployment.pipeline_result ?? "unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getVerdictVariant(deployment.verdict.verdict)} className="gap-1.5">
                              {getVerdictIcon(deployment.verdict.verdict)}
                              {getVerdictLabel(deployment.verdict.verdict)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(deployment.started_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm">
                              <IconClock className="size-3 text-muted-foreground" />
                              {formatDuration(deployment.duration_ms)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/dashboard/deployments/${projectNameToPathSegment(deployment.project)}/${deployment.internal_id}`}
                            >
                              <Button variant="ghost" size="sm">
                                View Details →
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No deployments found for this project</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diagnostics Tab */}
        <TabsContent value="diagnostics" className="space-y-4 mt-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">Diagnostics (SDH)</h2>
            <p className="text-muted-foreground">
              SeqPulse deployment diagnostics for {project.name}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Critical</CardDescription>
                <CardTitle className="text-3xl text-destructive">
                  {criticalSDH.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Warnings</CardDescription>
                <CardTitle className="text-3xl text-orange-500">
                  {warningSDH.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Info</CardDescription>
                <CardTitle className="text-3xl text-blue-500">
                  {infoSDH.length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* SDH List */}
          <div className="space-y-4">
            {criticalSDH.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-destructive">
                  Critical Issues
                </h3>
                {criticalSDH.map((sdh) => (
                  <SDHDetailCard key={sdh.id} sdh={sdh} />
                ))}
              </div>
            )}

            {warningSDH.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-orange-500">Warnings</h3>
                {warningSDH.map((sdh) => (
                  <SDHDetailCard key={sdh.id} sdh={sdh} />
                ))}
              </div>
            )}

            {infoSDH.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-blue-500">
                  Informational
                </h3>
                {infoSDH.map((sdh) => (
                  <SDHDetailCard key={sdh.id} sdh={sdh} />
                ))}
              </div>
            )}

            {projectSDH.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <IconCircleCheckFilled className="size-12 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No diagnostics available for this project
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          {/* Section 1: Project Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconKey className="size-5" />
                <CardTitle>Project Information</CardTitle>
              </div>
              <CardDescription>Basic project configuration and API access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <div className="flex items-center gap-2">
                    <Input value={project.name} readOnly className="font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Input value={project.env} readOnly className="capitalize" />
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Input value={project.plan} readOnly className="capitalize" />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input value={apiKeyMasked} readOnly className="font-mono text-xs" />
                    <CopyButton
                      text={apiKeyRaw}
                      label="API Key"
                      disabled={settingsLoading || apiKeyRaw.length === 0}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Security */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconShield className="size-5" />
                <CardTitle>Security</CardTitle>
              </div>
              <CardDescription>Configure HMAC authentication for enhanced security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="hmac">HMAC Authentication</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enable HMAC to verify deployment webhooks are from trusted sources
                  </p>
                </div>
                <button
                  onClick={handleHmacToggle}
                  disabled={hmacLoading || settingsLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    hmacEnabled ? 'bg-gray-500 dark:bg-gray-800' : 'dark:bg-muted bg-accent-foreground'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      hmacEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {hmacEnabled && (
                <div className="space-y-2 p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between">
                    <Label>HMAC Secret</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRotateHmac}
                      disabled={hmacLoading || settingsLoading}
                    >
                      Rotate Secret
                    </Button>
                  </div>
                  {hmacSecretOneShotRaw ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Input
                          value={hmacSecretMasked}
                          readOnly
                          className="font-mono text-xs"
                        />
                        <CopyButton text={hmacSecretOneShotRaw} label="HMAC Secret" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Secret revealed one-shot by backend. Store it now; it will not be readable again.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Secret not visible (backend one-shot behavior). Rotate to generate a new secret and copy it.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Metrics Endpoint */}
          <Card>
            <CardHeader>
              <CardTitle>Metrics Endpoint</CardTitle>
              <CardDescription>
                Changing the metrics endpoint will reset baseline metrics used for diagnostics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Current Endpoint</p>
                  <p className="font-mono text-sm break-all">{newEndpoint}</p>
                </div>
                <Dialog open={editEndpointOpen} onOpenChange={setEditEndpointOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={!canEditEndpoint && baselineReady}
                    >
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Metrics Endpoint</DialogTitle>
                      <DialogDescription>
                        This will reset your baseline metrics. SeqPulse will need to recalibrate.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="endpoint">Metrics Endpoint URL</Label>
                        <Input
                          id="endpoint"
                          value={newEndpoint}
                          onChange={(e) => setNewEndpoint(e.target.value)}
                          placeholder="https://api.example.com/ds-metrics"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditEndpointOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveEndpoint}>
                        Confirm & Reset Baseline
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {!canEditEndpoint && baselineReady && (
                <div className="flex items-start gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 p-3">
                  <IconAlertTriangle className="size-5 text-orange-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-500">Upgrade to Pro to change metrics endpoint</p>
                    <p className="text-muted-foreground mt-1">
                      Your baseline is already established. Changing the endpoint requires a Pro or Enterprise plan.
                    </p>
                  </div>
                </div>
              )}

              {!baselineReady && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                  <IconAlertTriangle className="size-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-500">Baseline not ready</p>
                    <p className="text-muted-foreground mt-1">
                      SeqPulse is collecting baseline metrics. This may take a few deployments.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Integration Snippets */}
          <Card>
            <CardHeader>
              <CardTitle>Integration Snippets</CardTitle>
              <CardDescription>
                Add SeqPulse to your application and CI/CD pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="metrics">
                <TabsList className="mb-4">
                  <TabsTrigger value="metrics">Application Metrics</TabsTrigger>
                  <TabsTrigger value="cicd">CI/CD Pipeline</TabsTrigger>
                </TabsList>

                <TabsContent value="metrics" className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Application Metrics Endpoint (Node.js)</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add this endpoint to your application to expose metrics to SeqPulse.
                    </p>
                    <CodeBlock
                      code={nodeSnippet}
                      filename="metrics-endpoint.ts"
                      language="javascript"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="cicd" className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">GitHub Actions Pipeline</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Integrate SeqPulse into your deployment workflow.
                    </p>
                    <CodeBlock
                      code={cicdSnippet}
                      filename=".github/workflows/deploy.yml"
                      language="yaml"
                    />
                  </div>

                  <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                    <h4 className="text-sm font-semibold">How it works</h4>
                    <p className="text-sm text-muted-foreground">
                      SeqPulse is called twice in your pipeline:
                    </p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>
                          <strong>Before deployment</strong> (<code className="bg-muted px-1 rounded">/trigger</code>) to capture baseline metrics (PRE)
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>
                          <strong>After deployment</strong> (<code className="bg-muted px-1 rounded">/finish</code>) to observe production metrics (POST)
                        </span>
                      </li>
                    </ul>
                    <p className="text-sm text-muted-foreground pt-2">
                      SeqPulse then analyzes the difference and decides: <Badge variant="outline">OK</Badge>, <Badge variant="outline">Warning</Badge>, or <Badge variant="destructive">Rollback recommended</Badge>.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Monitoring Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconClock className="size-5" />
                <CardTitle>Monitoring Configuration</CardTitle>
              </div>
              <CardDescription>Configure how SeqPulse monitors your deployments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Observation Window</Label>
                <p className="text-sm text-muted-foreground">
                  Duration to monitor after deployment before generating verdict
                </p>
                <RadioGroup value={observationWindow} onValueChange={setObservationWindow}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value="5min" 
                      id="5min" 
                      disabled={project.plan !== "free"}
                    />
                    <Label 
                      htmlFor="5min" 
                      className={project.plan !== "free" ? "text-muted-foreground" : ""}
                    >
                      5 minutes
                      <Badge variant="outline" className="ml-2">Free</Badge>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value="15min" 
                      id="15min"
                      disabled={project.plan === "free"}
                    />
                    <Label 
                      htmlFor="15min"
                      className={project.plan === "free" ? "text-muted-foreground" : ""}
                    >
                      15 minutes
                      <Badge variant="secondary" className="ml-2">Pro</Badge>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value="30min" 
                      id="30min"
                      disabled={project.plan !== "enterprise"}
                    />
                    <Label 
                      htmlFor="30min"
                      className={project.plan !== "enterprise" ? "text-muted-foreground" : ""}
                    >
                      30 minutes
                      <Badge variant="default" className="ml-2">Enterprise</Badge>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconAlertTriangleFilled className="size-5 text-destructive" />
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </div>
              <CardDescription>
                Irreversible actions that will permanently affect your project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <IconAlertTriangle className="size-4" />
                  Delete this project
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Once you delete a project, there is no going back. This will permanently delete:
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground mb-4">
                  <li className="flex items-start gap-2">
                    <IconChevronRight className="size-4 mt-0.5 shrink-0" />
                    All deployment history and metrics
                  </li>
                  <li className="flex items-start gap-2">
                    <IconChevronRight className="size-4 mt-0.5 shrink-0" />
                    All diagnostic hints (SDH)
                  </li>
                  <li className="flex items-start gap-2">
                    <IconChevronRight className="size-4 mt-0.5 shrink-0" />
                    Project configuration and API keys
                  </li>
                </ul>
                <DeleteProjectDialog projectName={project.name} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
