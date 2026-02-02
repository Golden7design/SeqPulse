"use client"

import { use, useState, useEffect, useRef } from "react"
import Link from "next/link"
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
import projectsData from "../../projects-data.json"
import deploymentsData from "../../deployments-data.json"
import sdhData from "../../sdh-data.json"
import { toast } from "sonner"

type Project = {
  id: string
  name: string
  env: string
  plan: string
  hmac_enabled: boolean
  stack: string[]
  last_deployment: {
    id: string
    verdict: "ok" | "attention" | "rollback_recommended"
    finished_at: string
  }
  stats: {
    deployments_total: number
    ok_count: number
    attention_count: number
    rollback_count: number
  }
  created_at: string
}

type Deployment = {
  id: string
  project: string
  env: string
  pipeline_result: string
  verdict: {
    verdict: "ok" | "attention" | "rollback_recommended"
    confidence: number
    summary: string
    details: string[]
  }
  state: string
  started_at: string
  finished_at: string
  duration_ms: number
}

type SDH = {
  id: string
  deployment_id: string
  project: string
  env: string
  severity: "critical" | "warning" | "info"
  metric: string
  observed_value: number
  threshold: number
  title: string
  diagnosis: string
  suggested_actions: string[]
  created_at: string
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

function getVerdictIcon(verdict: string) {
  switch (verdict) {
    case "ok":
      return <IconCircleCheckFilled className="size-4 text-green-500" />
    case "attention":
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
    case "attention":
      return "Attention"
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
    case "attention":
      return "outline"
    case "rollback_recommended":
      return "destructive"
    default:
      return "outline"
  }
}

function getPipelineResultVariant(result: string): "default" | "destructive" | "outline" {
  switch (result) {
    case "success":
      return "outline"
    case "failure":
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

function formatMetricValue(value: number, metric: string): string {
  if (metric.includes("rate") || metric.includes("usage")) {
    return `${(value * 100).toFixed(1)}%`
  }
  if (metric.includes("latency")) {
    return `${value}ms`
  }
  return value.toString()
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
            <p className="font-mono text-sm font-medium">{sdh.metric}</p>
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

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
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

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10">
        <CopyButton text={code} />
      </div>
      <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-xs">
        <code>{code}</code>
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

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const projects = projectsData as Project[]
  const project = projects.find((p) => p.id === projectId)
  const allDeployments = deploymentsData as Deployment[]
  const allSDH = sdhData as SDH[]
  
  // Filter deployments for this project
  const projectDeployments = allDeployments.filter((d) => d.project === project?.name)
  
  // Filter SDH for this project
  const projectSDH = allSDH.filter((sdh) => sdh.project === project?.name)
  
  // State for settings
  const [hmacEnabled, setHmacEnabled] = useState(project?.hmac_enabled || false)
  const [observationWindow, setObservationWindow] = useState("15min")
  const [editEndpointOpen, setEditEndpointOpen] = useState(false)
  const [newEndpoint, setNewEndpoint] = useState("https://billing.example.com/ds-metrics")
  const [baselineReady, setBaselineReady] = useState(true)
  
  // Generate mock API key based on project
  const apiKey = `SP_${project?.id.replace("prj_", "")}${"*".repeat(20)}ab12`

  if (!project) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Project not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const canEditEndpoint = project.plan === "pro" || project.plan === "enterprise"

  const handleSaveEndpoint = () => {
    setBaselineReady(false)
    setEditEndpointOpen(false)
    toast.success("Metrics endpoint updated. Baseline has been reset.")
  }

  // Group SDH by severity
  const criticalSDH = projectSDH.filter((sdh) => sdh.severity === "critical")
  const warningSDH = projectSDH.filter((sdh) => sdh.severity === "warning")
  const infoSDH = projectSDH.filter((sdh) => sdh.severity === "info")

  // Tabs scroll indicators
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

  const nodeSnippet = `import express from "express"
import os from "os"

const app = express()

let requestCount = 0
let latencies = []

// Middleware pour mesurer la latence
app.use((req, res, next) => {
  const start = process.hrtime.bigint()

  res.on("finish", () => {
    const end = process.hrtime.bigint()
    const ms = Number(end - start) / 1_000_000
    latencies.push(ms)
    requestCount++
  })

  next()
})

// Exemple d'endpoint normal
app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

// Utilitaire P95
function percentile(arr, p) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const index = Math.floor(p * sorted.length)
  return sorted[index]
}

// Endpoint SeqPulse
app.get("/ds-metrics", (req, res) => {
  const latency_p95 = percentile(latencies, 0.95)

  const memory = process.memoryUsage()
  const cpuLoad = os.loadavg()[0] / os.cpus().length

  const metrics = {
    requests_per_sec: requestCount / 60, // moyenne sur 1 min
    latency_p95: Math.round(latency_p95),
    error_rate: 0, // à brancher sur tes codes 5xx
    cpu_usage: Number(cpuLoad.toFixed(2)),
    memory_usage: Number((memory.rss / os.totalmem()).toFixed(2))
  }

  // reset fenêtre
  requestCount = 0
  latencies = []

  res.json(metrics)
})

app.listen(3001, () => {
  console.log("App listening on port 3001")
})`

  const cicdSnippet = `name: Deploy with SeqPulse

on:
  push:
    branches: [ "main" ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v3

      # PRE: notify SeqPulse before deployment
      - name: SeqPulse trigger
        id: seqpulse_trigger
        run: |
          RESPONSE=$(curl -s -X POST https://api.seqpulse.io/deployments/trigger \\
            -H "X-API-Key: ${apiKey}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "env": "${project.env}",
              "metrics_endpoint": "${newEndpoint}"
            }')

          echo "Deployment created: $RESPONSE"

      # Your real deployment step
      - name: Deploy application
        run: |
          echo "Deploying application..."
          sleep 5

      # POST: notify SeqPulse after deployment
      - name: SeqPulse finish
        run: |
          curl -X POST https://api.seqpulse.io/deployments/finish \\
            -H "X-API-Key: ${apiKey}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "deployment_id": "dpl_123",
              "result": "success",
              "metrics_endpoint": "${newEndpoint}"
            }'`

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
            {project.hmac_enabled ? (
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
      <Tabs defaultValue="overview" className="w-full">
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
                <CardDescription>Attention Needed</CardDescription>
                <CardTitle className="text-3xl text-orange-500">
                  {project.stats.attention_count}
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
                  <p className="font-mono text-sm">{project.last_deployment.id}</p>
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
                            {deployment.id}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getEnvVariant(deployment.env)} className="capitalize">
                              {deployment.env}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getPipelineResultVariant(deployment.pipeline_result)} className="capitalize">
                              {deployment.pipeline_result}
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
                            <Link href={`/dashboard/deployments/${deployment.id}`}>
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
                    <Input value={apiKey} readOnly className="font-mono text-xs" />
                    <CopyButton text={apiKey} label="API Key" />
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
                  onClick={() => setHmacEnabled(!hmacEnabled)}
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
                  <Label>HMAC Secret</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={`hmac_${project.id}_${"*".repeat(32)}`} 
                      readOnly 
                      className="font-mono text-xs" 
                    />
                    <CopyButton text={`hmac_${project.id}_secret`} label="HMAC Secret" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this secret to sign your deployment requests
                  </p>
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
                    <CodeBlock code={nodeSnippet} />
                  </div>
                </TabsContent>

                <TabsContent value="cicd" className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">GitHub Actions Pipeline</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Integrate SeqPulse into your deployment workflow.
                    </p>
                    <CodeBlock code={cicdSnippet} />
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
                      SeqPulse then analyzes the difference and decides: <Badge variant="outline">OK</Badge>, <Badge variant="outline">Attention</Badge>, or <Badge variant="destructive">Rollback recommended</Badge>.
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