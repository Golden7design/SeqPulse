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
  IconCode,
  IconBrandSlack
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
import { ProjectDetailPageSkeleton } from "@/components/page-skeletons"
import { useTranslation } from "@/components/providers/i18n-provider"
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
  deleteProject,
  disableProjectHmac,
  enableProjectHmac,
  getProjectEndpoint,
  getProjectObservationWindow,
  getProjectPublic,
  getProjectSlackConfig,
  type ProjectEndpointConfig,
  rotateProjectHmac,
  sendProjectSlackTestMessage,
  testProjectEndpoint,
  updateProjectEndpoint,
  updateProjectObservationWindow,
  updateProjectSlackConfig,
} from "@/lib/projects-client"

type Project = ProjectDashboard
type Deployment = DeploymentDashboard
type SDH = SDHItem
type EndpointConfig = ProjectEndpointConfig
const DEPLOYMENTS_PAGE_SIZE = 10

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
    case "pro":
      return "secondary"
    case "free":
      return "outline"
    default:
      return "outline"
  }
}

function getEndpointStateVariant(state: EndpointConfig["state"] | undefined): "default" | "secondary" | "destructive" | "outline" {
  if (state === "active") return "default"
  if (state === "pending_verification") return "secondary"
  if (state === "blocked") return "destructive"
  return "outline"
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
  const visibleChars = 3
  if (value.length <= visibleChars) return value
  return `${value.slice(0, visibleChars)}${"*".repeat(value.length - visibleChars)}`
}

function toSdkEndpointPath(endpoint: string): string {
  const fallback = "/seqpulse-metrics"
  if (!endpoint || endpoint.trim().length === 0) return fallback

  const value = endpoint.trim()
  try {
    const parsed = new URL(value)
    if (!parsed.pathname) return fallback
    return parsed.pathname.startsWith("/") ? parsed.pathname : `/${parsed.pathname}`
  } catch {
    if (value.startsWith("http://") || value.startsWith("https://")) return fallback
    return value.startsWith("/") ? value : `/${value}`
  }
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
  const hasCompositeSignals =
    sdh.metric === "composite" && (sdh.composite_signals?.length ?? 0) > 0

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
        {hasCompositeSignals ? (
          <div className="rounded-lg border p-4">
            <div className="mb-3">
              <p className="text-xs text-muted-foreground">Metric</p>
              <p className="font-mono text-sm font-semibold">{formatMetricLabel(sdh.metric)}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sdh.composite_signals?.map((signal) => (
                <div key={signal.metric} className="w-full rounded-md border bg-muted/20 p-3">
                  <p className="font-mono text-sm font-semibold">{formatMetricLabel(signal.metric)}</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-md border bg-background/70 p-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Observed</p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatMetricValue(signal.observed_value, signal.metric)}
                      </p>
                    </div>
                    <div className="rounded-md border bg-background/70 p-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Threshold</p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatMetricValue(signal.threshold, signal.metric)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
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
        )}

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

function CopyButton({
  text,
  label,
  disabled,
  forceWhiteIcon = false,
}: {
  text: string
  label?: string
  disabled?: boolean
  forceWhiteIcon?: boolean
}) {
  const { t } = useTranslation()
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
      const copySuccess = label
        ? t("projects.detail.toasts.copyWithLabel").replace("{label}", label)
        : t("projects.detail.toasts.copySuccess")
      toast.success(copySuccess)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
      toast.error(t("projects.detail.toasts.copyError"))
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleCopy}
      disabled={disabled}
      className="shrink-0 hover:bg-gray-700"
    >
      {copied ? (
        <IconCheck className={`size-4 ${forceWhiteIcon ? "text-white" : "text-green-500"}`} />
      ) : (
        <IconCopy className={`size-4 ${forceWhiteIcon ? "text-white" : ""}`} />
      )}
    </Button>
  )
}

function classifySnippetToken(token: string, language: "javascript" | "yaml" | "bash" | "python"): string {
  if (token.length === 0) return "text-slate-300"

  if (language === "bash") {
    if (/^\s*#/.test(token)) return "text-slate-500 italic"
    if (/^["'`].*["'`]$/.test(token)) return "text-emerald-300"
    if (/^(?:npm|pnpm|pip|export|if|then|else|fi|set|curl|jq|echo|python|node)$/.test(token)) {
      return "text-violet-300"
    }
    if (/^\$\{[A-Z0-9_]+\}$/.test(token) || /^\$\{\{.*\}\}$/.test(token)) return "text-fuchsia-300"
    if (/^[A-Z0-9_]+=/.test(token)) return "text-orange-300"
    return "text-slate-200"
  }

  if (language === "python") {
    if (/^\s*#/.test(token)) return "text-slate-500 italic"
    if (/^["'`].*["'`]$/.test(token)) return "text-emerald-300"
    if (/^(?:from|import|as|def|class|return|if|else|for|in|True|False|None|await|async)$/.test(token)) {
      return "text-sky-300"
    }
    if (/^\d+(?:\.\d+)?$/.test(token)) return "text-amber-300"
    return "text-slate-200"
  }

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

function renderHighlightedLine(line: string, language: "javascript" | "yaml" | "bash" | "python"): ReactNode[] {
  const tokenPattern =
    language === "javascript"
      ? /(\/\/.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b(?:const|let|var|function|async|await|return|if|else|try|catch|throw|import|from|new|for|of|true|false|null|undefined|Math|Number|Date|JSON|fetch)\b|\b\d+(?:\.\d+)?\b)/g
      : language === "python"
        ? /(#.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:from|import|as|def|class|return|if|else|for|in|True|False|None|await|async)\b|\b\d+(?:\.\d+)?\b)/g
        : language === "bash"
          ? /(#.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\$\{\{[^}]+\}\}|\$\{[A-Z0-9_]+\}|\b(?:npm|pnpm|pip|export|if|then|else|fi|set|curl|jq|echo|python|node)\b|[A-Z0-9_]+=)/g
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
  language: "javascript" | "yaml" | "bash" | "python"
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
          <CopyButton text={code} forceWhiteIcon />
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

function DeleteProjectDialog({
  projectId,
  projectName,
  onDeleted,
}: {
  projectId: string
  projectName: string
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const [confirmName, setConfirmName] = useState("")
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!projectId || isDeleting) return
    setIsDeleting(true)
    try {
      await deleteProject(projectId, { confirmation_name: confirmName })
      toast.success(t("projects.detail.toasts.deleteSuccess"))
      setOpen(false)
      setConfirmName("")
      onDeleted()
    } catch (err) {
      const message = err instanceof Error ? err.message : t("projects.detail.toasts.deleteError")
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
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
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmName !== projectName || isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ProjectDetailPage({ params }: { params: Promise<{ projectName: string }> }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { projectName: rawProjectName } = use(params)
  const projectSegment = decodeURIComponent(rawProjectName)
  const searchParams = useSearchParams()
  const requestedTab = searchParams?.get("tab")
  const allowedTabs = new Set(["overview", "deployments", "diagnostics", "integration", "settings"])
  const defaultTab = requestedTab && allowedTabs.has(requestedTab) ? requestedTab : "overview"

  const [project, setProject] = useState<Project | null>(null)
  const [projectId, setProjectId] = useState("")
  const [projectDeployments, setProjectDeployments] = useState<Deployment[]>([])
  const [deploymentsPageIndex, setDeploymentsPageIndex] = useState(0)
  const [projectSDH, setProjectSDH] = useState<SDH[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [hmacEnabled, setHmacEnabled] = useState(false)
  const [apiKeyRaw, setApiKeyRaw] = useState<string>("")
  const [hmacSecretOneShotRaw, setHmacSecretOneShotRaw] = useState<string>("")
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [hmacLoading, setHmacLoading] = useState(false)
  const [observationWindow, setObservationWindow] = useState<"5min" | "15min">("15min")
  const [observationEditable, setObservationEditable] = useState(false)
  const [observationSaving, setObservationSaving] = useState(false)
  const [editEndpointOpen, setEditEndpointOpen] = useState(false)
  const [newEndpoint, setNewEndpoint] = useState("")
  const [endpointConfig, setEndpointConfig] = useState<EndpointConfig | null>(null)
  const [endpointSaving, setEndpointSaving] = useState(false)
  const [endpointTesting, setEndpointTesting] = useState(false)
  const [slackEnabled, setSlackEnabled] = useState(false)
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("")
  const [slackWebhookConfigured, setSlackWebhookConfigured] = useState(false)
  const [slackWebhookPreview, setSlackWebhookPreview] = useState("")
  const [slackChannel, setSlackChannel] = useState("")
  const [slackSaving, setSlackSaving] = useState(false)
  const [slackTesting, setSlackTesting] = useState(false)
  const [slackProOnlyDialogOpen, setSlackProOnlyDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadProjectData = async () => {
      setLoading(true)
      setSettingsLoading(true)
      setObservationSaving(false)
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
          setObservationWindow("15min")
          setObservationEditable(false)
          setApiKeyRaw("")
          setHmacEnabled(false)
          setSlackEnabled(false)
          setSlackWebhookUrl("")
          setSlackWebhookConfigured(false)
          setSlackWebhookPreview("")
          setSlackChannel("")
          setEndpointConfig(null)
          setNewEndpoint("")
          return
        }

        const resolvedProjectId = selectedProject.internal_id || selectedProject.id
        const [
          projectData,
          deploymentsData,
          sdhData,
          projectPublic,
          projectSlack,
          projectObservation,
          projectEndpoint,
        ] = await Promise.all([
          getProject(resolvedProjectId),
          listDeployments(resolvedProjectId),
          listSDH({ project_id: resolvedProjectId, limit: 200 }),
          getProjectPublic(resolvedProjectId),
          getProjectSlackConfig(resolvedProjectId),
          getProjectObservationWindow(resolvedProjectId),
          getProjectEndpoint(resolvedProjectId),
        ])
        if (cancelled) return

        setProject(projectData)
        setProjectId(resolvedProjectId)
        setProjectDeployments(deploymentsData)
        setProjectSDH(sdhData)
        setObservationWindow(projectObservation.observation_window_minutes === 5 ? "5min" : "15min")
        setObservationEditable(projectObservation.editable)
        setApiKeyRaw(projectPublic.api_key)
        setHmacEnabled(projectPublic.hmac_enabled)
        setHmacSecretOneShotRaw("")
        setSlackEnabled(projectSlack.enabled)
        setSlackWebhookConfigured(projectSlack.webhook_url_configured)
        setSlackWebhookPreview(projectSlack.webhook_url_preview || "")
        setSlackChannel(projectSlack.channel || "")
        setEndpointConfig(projectEndpoint)
        setNewEndpoint(projectEndpoint.candidate_endpoint || projectEndpoint.active_endpoint || "")

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
        setObservationWindow("15min")
        setObservationEditable(false)
        setApiKeyRaw("")
        setHmacEnabled(false)
        setSlackEnabled(false)
        setSlackWebhookUrl("")
        setSlackWebhookConfigured(false)
        setSlackWebhookPreview("")
        setSlackChannel("")
        setEndpointConfig(null)
        setNewEndpoint("")
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

  const deploymentsPageCount = Math.max(1, Math.ceil(projectDeployments.length / DEPLOYMENTS_PAGE_SIZE))

  useEffect(() => {
    setDeploymentsPageIndex(0)
  }, [projectId])

  useEffect(() => {
    setDeploymentsPageIndex((current) => {
      const maxIndex = Math.max(0, deploymentsPageCount - 1)
      return Math.min(current, maxIndex)
    })
  }, [deploymentsPageCount])

  if (loading && !project) {
    return <ProjectDetailPageSkeleton />
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

  const apiKeyMasked = maskSecret(apiKeyRaw) || "*".repeat(32)
  const hmacSecretMasked = maskSecret(hmacSecretOneShotRaw)
  const endpointState = endpointConfig?.state
  const endpointForSnippet =
    endpointConfig?.active_endpoint ||
    endpointConfig?.candidate_endpoint ||
    newEndpoint ||
    "https://api.example.com/ds-metrics"
  const endpointPathForSnippet = toSdkEndpointPath(endpointForSnippet)
  const hmacSecretForSnippet = hmacEnabled
    ? (hmacSecretOneShotRaw || "hmac_xxx")
    : "hmac_xxx"
  const endpointStateLabel =
    endpointState === "active"
      ? t("projects.detail.endpointState.active")
      : endpointState === "pending_verification"
        ? t("projects.detail.endpointState.pendingVerification")
        : endpointState === "blocked"
          ? t("projects.detail.endpointState.blocked")
          : t("projects.detail.endpointState.unknown")
  const hasLastDeployment =
    project.stats.deployments_total > 0 &&
    Boolean(project.last_deployment.id && project.last_deployment.finished_at)

  const handleHmacToggle = async () => {
    if (hmacLoading || !projectId) return
    setHmacLoading(true)
    try {
      if (hmacEnabled) {
        const updated = await disableProjectHmac(projectId)
        setHmacEnabled(updated.hmac_enabled)
        setApiKeyRaw(updated.api_key)
        setHmacSecretOneShotRaw("")
        toast.success(t("projects.detail.toasts.hmacDisabled"))
      } else {
        const created = await enableProjectHmac(projectId)
        setHmacEnabled(true)
        setHmacSecretOneShotRaw(created.hmac_secret)
        toast.success(t("projects.detail.toasts.hmacEnabled"))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("projects.detail.toasts.hmacActionFailed")
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
      toast.success(t("projects.detail.toasts.hmacRotateSuccess"))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("projects.detail.toasts.hmacRotateFailed")
      toast.error(message)
    } finally {
      setHmacLoading(false)
    }
  }

  const handleSaveEndpoint = async () => {
    if (!projectId || endpointSaving) return

    setEndpointSaving(true)
    try {
      const updated = await updateProjectEndpoint(projectId, {
        metrics_endpoint: newEndpoint.trim(),
      })
      setEndpointConfig(updated)
      setEditEndpointOpen(false)
      toast.success(t("projects.detail.toasts.endpointSaveSuccess"))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("projects.detail.toasts.endpointSaveFailed")
      toast.error(message)
    } finally {
      setEndpointSaving(false)
    }
  }

  const handleTestEndpoint = async () => {
    if (!projectId || endpointTesting) return

    setEndpointTesting(true)
    try {
      const updated = await testProjectEndpoint(projectId)
      setEndpointConfig(updated)
      setNewEndpoint(updated.active_endpoint || updated.candidate_endpoint || "")
      toast.success(t("projects.detail.toasts.endpointTestSuccess"))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("projects.detail.toasts.endpointTestFailed")
      toast.error(message)
    } finally {
      setEndpointTesting(false)
    }
  }

  const handleObservationWindowChange = async (nextValue: string) => {
    if (nextValue !== "5min" && nextValue !== "15min") return
    if (!projectId || !observationEditable || observationSaving) return
    if (nextValue === observationWindow) return

    const previousValue = observationWindow
    setObservationWindow(nextValue)
    setObservationSaving(true)

    try {
      const updated = await updateProjectObservationWindow(projectId, {
        observation_window_minutes: nextValue === "5min" ? 5 : 15,
      })
      const resolvedValue = updated.observation_window_minutes === 5 ? "5min" : "15min"
      setObservationWindow(resolvedValue)
      toast.success(
        resolvedValue === "5min"
          ? t("projects.detail.toasts.observationSet5")
          : t("projects.detail.toasts.observationSet15")
      )
    } catch (err) {
      setObservationWindow(previousValue)
      const message = err instanceof Error ? err.message : t("projects.detail.toasts.observationUpdateFailed")
      toast.error(message)
    } finally {
      setObservationSaving(false)
    }
  }

  const handleSlackToggle = async () => {
    if (!projectId) return
    if (project.plan !== "pro") {
      setSlackProOnlyDialogOpen(true)
      return
    }

    const nextValue = !slackEnabled
    if (nextValue && !slackWebhookConfigured && slackWebhookUrl.trim().length === 0) {
      toast.error(t("projects.detail.toasts.slackWebhookRequired"))
      return
    }

    setSlackSaving(true)
    try {
      const updated = await updateProjectSlackConfig(projectId, {
        enabled: nextValue,
        webhook_url: slackWebhookUrl.trim() || undefined,
        channel: slackChannel.trim() || undefined,
      })
      setSlackEnabled(updated.enabled)
      setSlackWebhookConfigured(updated.webhook_url_configured)
      setSlackWebhookPreview(updated.webhook_url_preview || "")
      setSlackChannel(updated.channel || "")
      if (slackWebhookUrl.trim().length > 0) {
        setSlackWebhookUrl("")
      }
      toast.success(nextValue ? t("projects.detail.toasts.slackToggleEnabled") : t("projects.detail.toasts.slackToggleDisabled"))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("projects.detail.toasts.slackToggleFailed")
      toast.error(message)
    } finally {
      setSlackSaving(false)
    }
  }

  const handleSlackSave = async () => {
    if (!projectId) return
    if (project.plan !== "pro") {
      setSlackProOnlyDialogOpen(true)
      return
    }
    if (slackWebhookUrl.trim().length === 0 && slackChannel.trim().length === 0) {
      toast.error(t("projects.detail.toasts.slackFieldsRequired"))
      return
    }

    setSlackSaving(true)
    try {
      const updated = await updateProjectSlackConfig(projectId, {
        enabled: slackEnabled,
        webhook_url: slackWebhookUrl.trim() || undefined,
        channel: slackChannel.trim() || undefined,
      })
      setSlackEnabled(updated.enabled)
      setSlackWebhookConfigured(updated.webhook_url_configured)
      setSlackWebhookPreview(updated.webhook_url_preview || "")
      setSlackChannel(updated.channel || "")
      setSlackWebhookUrl("")
      toast.success(t("projects.detail.toasts.slackSaveSuccess"))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("projects.detail.toasts.slackSaveFailed")
      toast.error(message)
    } finally {
      setSlackSaving(false)
    }
  }

  const handleSlackTest = async () => {
    if (!projectId) return
    setSlackTesting(true)
    try {
      const result = await sendProjectSlackTestMessage(projectId)
      if (result.status === "sent") {
        toast.success(t("projects.detail.toasts.slackTestSent"))
      } else {
        toast.success(t("projects.detail.toasts.slackTestResult").replace("{status}", result.status))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("projects.detail.toasts.slackTestFailed")
      toast.error(message)
    } finally {
      setSlackTesting(false)
    }
  }

  const criticalSDH = projectSDH.filter((sdh) => sdh.severity === "critical")
  const warningSDH = projectSDH.filter((sdh) => sdh.severity === "warning")
  const infoSDH = projectSDH.filter((sdh) => sdh.severity === "info")
  const deploymentsPageStart = deploymentsPageIndex * DEPLOYMENTS_PAGE_SIZE
  const paginatedProjectDeployments = projectDeployments.slice(
    deploymentsPageStart,
    deploymentsPageStart + DEPLOYMENTS_PAGE_SIZE
  )

  const installSnippet = `npm install seqpulse
# or
pnpm add seqpulse
# or
pip install seqpulse`

  const ciSecretsSnippet = `SEQPULSE_API_KEY=<project-api-key>
SEQPULSE_BASE_URL=https://api.seqpulse.io
SEQPULSE_METRICS_ENDPOINT=${endpointForSnippet}`

  const appEnvSnippet = `SEQPULSE_HMAC_ENABLE=${hmacEnabled ? "true" : "false"}
SEQPULSE_HMAC_SECRET=${hmacSecretForSnippet} `

  const nodeSnippet = `const express = require("express")
const seqpulse = require("seqpulse")

const app = express()

seqpulse.init({
  endpoint: "${endpointPathForSnippet}",
  hmacEnabled: process.env.SEQPULSE_HMAC_ENABLE === "true",
  hmacSecret: process.env.SEQPULSE_HMAC_SECRET,
})

app.use(seqpulse.metrics())

app.get("/", (_req, res) => res.send("ok"))

app.listen(3000, () => {
  console.log("SeqPulse metrics endpoint ready on ${endpointPathForSnippet}")
})`

  const pythonSnippet = `import os
from fastapi import FastAPI
from seqpulse import SeqPulse

app = FastAPI()

seqpulse = SeqPulse(
    endpoint="${endpointPathForSnippet}",
    hmac_enabled=os.getenv("SEQPULSE_HMAC_ENABLE", "${hmacEnabled ? "true" : "false"}").lower() == "true",
    hmac_secret=os.getenv("SEQPULSE_HMAC_SECRET", "${hmacSecretForSnippet}"),
)

app.middleware("http")(seqpulse.middleware())

@app.get("/")
def health():
    return {"status": "ok"}`

  const apiBaseForSnippet = "https://api.seqpulse.io"

  const cicdSnippet = `name: Deploy with SeqPulse

on:
  push:
    branches: ["main"]

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SEQPULSE_BASE_URL: "${apiBaseForSnippet}"
      SEQPULSE_API_KEY: "\${{ secrets.SEQPULSE_API_KEY }}"
      SEQPULSE_ENV: "${project.env}"
      SEQPULSE_METRICS_ENDPOINT: "${endpointForSnippet}"

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Trigger deployment (PRE metrics)
        id: seqpulse_trigger
        run: |
          set -euo pipefail

          RESPONSE=$(curl -sS -X POST "\${SEQPULSE_BASE_URL}/deployments/trigger" \\
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

          curl -sS -X POST "\${SEQPULSE_BASE_URL}/deployments/finish" \\
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
                <TabsTrigger className="shrink-0" value="overview">{t("projects.detail.tabs.overview")}</TabsTrigger>
                <TabsTrigger className="shrink-0" value="deployments">
                  <span className="inline-flex items-center gap-2">
                    <span>{t("projects.detail.tabs.deployments")}</span>
                    {projectDeployments.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {projectDeployments.length}
                      </Badge>
                    )}
                  </span>
                </TabsTrigger>
                <TabsTrigger className="shrink-0" value="diagnostics">
                  <span className="inline-flex items-center gap-2">
                    <span>{t("projects.detail.tabs.diagnostics")}</span>
                    {projectSDH.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {projectSDH.length}
                      </Badge>
                    )}
                  </span>
                </TabsTrigger>
                <TabsTrigger className="shrink-0" value="integration">
                  <IconCode className="size-4" />
                  {t("projects.detail.tabs.integration")}
                </TabsTrigger>
                <TabsTrigger className="shrink-0" value="settings">
                  <IconKey className="size-4" />
                  {t("projects.detail.tabs.settings")}
                </TabsTrigger>
              </div>

              {/* Left / Right scroll indicators */}
              <div className={`pointer-events-none absolute -left-7 top-0 bottom-0 flex items-center pl-2 transition-opacity ${showLeftTabs ? 'opacity-100' : 'opacity-0'}`}>
                <div className="bg-linear-to-r from-base-100/90 to-transparent rounded-full p-1">
                  <svg className="w-4 h-4 text-black dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </div>
              </div>

              <div className={`pointer-events-none absolute -right-7 top-0 bottom-0 flex items-center pr-2 transition-opacity ${showRightTabs ? 'opacity-100' : 'opacity-0'}`}>
                <div className="bg-linear-to-l from-base-100/90 to-transparent rounded-full p-1">
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
                  <p className="font-mono text-sm">
                    {hasLastDeployment ? publicDeploymentIdToDisplay(project.last_deployment.id) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Verdict</p>
                  {hasLastDeployment ? (
                    <Badge variant={getVerdictVariant(project.last_deployment.verdict)} className="gap-1.5">
                      {getVerdictIcon(project.last_deployment.verdict)}
                      {getVerdictLabel(project.last_deployment.verdict)}
                    </Badge>
                  ) : (
                    <Badge variant="outline">N/A</Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Finished At</p>
                  <p className="text-sm">
                    {hasLastDeployment ? new Date(project.last_deployment.finished_at).toLocaleString() : "-"}
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
                <>
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
                        {paginatedProjectDeployments.map((deployment) => (
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
                  <div className="flex items-center justify-between px-4 pt-4">
                    <div className="text-muted-foreground text-sm">
                      Showing {paginatedProjectDeployments.length} of {projectDeployments.length} deployments
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeploymentsPageIndex((current) => Math.max(0, current - 1))}
                        disabled={deploymentsPageIndex === 0}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDeploymentsPageIndex((current) => Math.min(deploymentsPageCount - 1, current + 1))
                        }
                        disabled={deploymentsPageIndex >= deploymentsPageCount - 1}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
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

        {/* Integration Tab */}
        <TabsContent value="integration" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("projects.detail.integration.workflow.title")}</CardTitle>
              <CardDescription>
                {t("projects.detail.integration.workflow.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">1</Badge>
                  <span>{t("projects.detail.integration.workflow.items.installSdk")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">2</Badge>
                  <span>{t("projects.detail.integration.workflow.items.configureEnv")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">3</Badge>
                  <span>{t("projects.detail.integration.workflow.items.instrumentApp")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">4</Badge>
                  <span>{t("projects.detail.integration.workflow.items.integratePipeline")}</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("projects.detail.integration.step1.title")}</CardTitle>
              <CardDescription>{t("projects.detail.integration.step1.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock
                code={installSnippet}
                filename="install.sh"
                language="bash"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("projects.detail.integration.step2.title")}</CardTitle>
              <CardDescription>
                {t("projects.detail.integration.step2.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t("projects.detail.integration.step2.ciSecretsTitle")}</h4>
                <CodeBlock
                  code={ciSecretsSnippet}
                  filename="pipeline-secrets"
                  language="bash"
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t("projects.detail.integration.step2.appEnvTitle")}</h4>
                <p className="text-xs text-muted-foreground">
                  {t("projects.detail.integration.step2.appEnvHmacNote")}
                </p>
                <CodeBlock
                  code={appEnvSnippet}
                  filename="runtime.env"
                  language="bash"
                />
              </div>

              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p className="text-muted-foreground">
                  {t("projects.detail.integration.step2.endpointStateLabel")}{" "}
                  <Badge variant={getEndpointStateVariant(endpointState)}>
                    {endpointStateLabel}
                  </Badge>
                </p>
                <p className="text-muted-foreground">
                  {t("projects.detail.integration.step2.endpointUsedLabel")}{" "}
                  <span className="font-mono text-foreground">{endpointForSnippet}</span>
                </p>
              </div>

              {endpointState !== "active" && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                  <p className="text-sm text-muted-foreground">
                    {t("projects.detail.integration.step2.notActiveNote")}
                  </p>
                  <Button className="mt-3" onClick={handleTestEndpoint} disabled={endpointTesting || !endpointConfig}>
                    {endpointTesting
                      ? t("projects.detail.integration.step2.runTestLoading")
                      : t("projects.detail.integration.step2.runTest")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("projects.detail.integration.step3.title")}</CardTitle>
              <CardDescription>
                {t("projects.detail.integration.step3.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="node">
                <TabsList className="mb-4">
                  <TabsTrigger value="node">{t("projects.detail.integration.step3.nodeTab")}</TabsTrigger>
                  <TabsTrigger value="python">{t("projects.detail.integration.step3.pythonTab")}</TabsTrigger>
                </TabsList>
                <TabsContent value="node">
                  <CodeBlock
                    code={nodeSnippet}
                    filename="app.js"
                    language="javascript"
                  />
                </TabsContent>
                <TabsContent value="python">
                  <CodeBlock
                    code={pythonSnippet}
                    filename="main.py"
                    language="python"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("projects.detail.integration.step4.title")}</CardTitle>
              <CardDescription>
                {t("projects.detail.integration.step4.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CodeBlock
                code={cicdSnippet}
                filename=".github/workflows/deploy.yml"
                language="yaml"
              />
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <h4 className="text-sm font-semibold">{t("projects.detail.integration.step4.sequenceTitle")}</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{t("projects.detail.integration.step4.preLine")} <code className="bg-muted px-1 rounded">/deployments/trigger</code>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{t("projects.detail.integration.step4.postLine")} <code className="bg-muted px-1 rounded">/deployments/finish</code>.</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
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
                Candidate endpoint must be tested before activation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">State</p>
                    <Badge variant={getEndpointStateVariant(endpointState)}>
                      {endpointStateLabel}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Active endpoint</p>
                    <p className="font-mono text-sm break-all">
                      {endpointConfig?.active_endpoint || endpointConfig?.active_endpoint_masked || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Candidate endpoint</p>
                    <p className="font-mono text-sm break-all">
                      {endpointConfig?.candidate_endpoint || endpointConfig?.candidate_endpoint_masked || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 md:w-auto">
                  <Dialog open={editEndpointOpen} onOpenChange={setEditEndpointOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full md:w-auto">Edit Candidate</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Metrics Endpoint</DialogTitle>
                        <DialogDescription>
                          Save candidate endpoint, then run test to activate it.
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
                        <Button
                          variant="outline"
                          onClick={() => setEditEndpointOpen(false)}
                          disabled={endpointSaving}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveEndpoint}
                          disabled={endpointSaving || newEndpoint.trim().length === 0}
                        >
                          {endpointSaving ? "Saving..." : "Save Candidate"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button className="w-full md:w-auto" onClick={handleTestEndpoint} disabled={endpointTesting || !endpointConfig}>
                    {endpointTesting ? "Testing..." : "Run Test & Activate"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p className="text-muted-foreground">
                  Path changes:{" "}
                  <span className="font-medium text-foreground">
                    {endpointConfig?.changes_used ?? 0}
                    {endpointConfig?.changes_limit !== null && endpointConfig?.changes_limit !== undefined
                      ? ` / ${endpointConfig.changes_limit}`
                      : " / unlimited"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Host migrations:{" "}
                  <span className="font-medium text-foreground">
                    {endpointConfig?.migrations_used ?? 0}
                    {endpointConfig?.migrations_limit !== null && endpointConfig?.migrations_limit !== undefined
                      ? ` / ${endpointConfig.migrations_limit}`
                      : " / unlimited"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Host lock: <span className="font-medium text-foreground">{endpointConfig?.host_lock || "-"}</span>
                </p>
                <p className="text-muted-foreground">
                  Baseline version:{" "}
                  <span className="font-medium text-foreground">{endpointConfig?.baseline_version ?? 1}</span>
                </p>
              </div>

              {endpointState === "pending_verification" && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                  <IconAlertTriangle className="size-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-500">Pending verification</p>
                    <p className="text-muted-foreground mt-1">
                      Run endpoint test to activate candidate endpoint and unlock deployment flow.
                    </p>
                  </div>
                </div>
              )}

              {endpointState === "blocked" && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <IconAlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-red-500">Endpoint blocked</p>
                    <p className="text-muted-foreground mt-1">
                      Project endpoint is blocked. Update candidate endpoint and run verification.
                    </p>
                  </div>
                </div>
              )}

              {!!endpointConfig?.last_test_error_code && (
                <p className="text-sm text-red-600">
                  Last test error: {endpointConfig.last_test_error_code}
                </p>
              )}
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
                <RadioGroup value={observationWindow} onValueChange={handleObservationWindowChange}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value="5min" 
                      id="5min" 
                      disabled={!observationEditable || settingsLoading || observationSaving}
                    />
                    <Label 
                      htmlFor="5min" 
                      className={!observationEditable || settingsLoading || observationSaving ? "text-muted-foreground" : ""}
                    >
                      5 minutes
                      <Badge variant="outline" className="ml-2">Free</Badge>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value="15min" 
                      id="15min"
                      disabled={!observationEditable || settingsLoading || observationSaving}
                    />
                    <Label 
                      htmlFor="15min"
                      className={!observationEditable || settingsLoading || observationSaving ? "text-muted-foreground" : ""}
                    >
                      15 minutes
                      <Badge variant="secondary" className="ml-2">Pro</Badge>
                    </Label>
                  </div>
                </RadioGroup>
                {!observationEditable && (
                  <p className="text-xs text-muted-foreground">
                    Plan Free: observation window verrouillée à 5 minutes.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Slack Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconBrandSlack className="size-5" />
                <CardTitle>Slack Integration</CardTitle>
              </div>
              <CardDescription>
                Activez les notifications Slack pour centraliser les alertes de ce projet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                <Input
                  id="slack-webhook"
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  autoComplete="off"
                />
                {slackWebhookConfigured && (
                  <p className="text-xs text-muted-foreground">
                    Webhook configuré: <span className="font-mono">{slackWebhookPreview}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slack-channel">Canal Slack (optionnel)</Label>
                <Input
                  id="slack-channel"
                  value={slackChannel}
                  onChange={(e) => setSlackChannel(e.target.value)}
                  placeholder="#seqpulse-alerts"
                  autoComplete="off"
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Statut</p>
                  <p className="text-sm text-muted-foreground">
                    {slackEnabled ? "Slack est activé pour ce projet." : "Slack n'est pas encore activé."}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant={project.plan === "pro" ? "secondary" : "outline"}>
                      {project.plan === "pro"
                        ? "Projet Pro"
                        : `Projet ${project.plan.charAt(0).toUpperCase()}${project.plan.slice(1)}`}
                    </Badge>
                    {project.plan !== "pro" && (
                      <span className="text-xs text-muted-foreground">Slack est réservé aux projets Pro.</span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleSlackToggle}
                  variant={slackEnabled ? "outline" : "default"}
                  disabled={slackSaving}
                >
                  {slackEnabled ? "Désactiver Slack" : "Activer Slack"}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={handleSlackSave} disabled={slackSaving}>
                  {slackSaving ? "Enregistrement..." : "Enregistrer Slack"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSlackTest}
                  disabled={slackTesting || !slackEnabled || project.plan !== "pro"}
                >
                  {slackTesting ? "Envoi..." : "Envoyer un test"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Dialog open={slackProOnlyDialogOpen} onOpenChange={setSlackProOnlyDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Slack est disponible uniquement pour les projets Pro</DialogTitle>
                <DialogDescription>
                  L&apos;intégration Slack est réservée aux projets Pro afin de garantir les capacités
                  de notifications collaboratives en temps réel. Passez votre projet en Pro pour l&apos;activer.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSlackProOnlyDialogOpen(false)}>
                  Compris
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                <DeleteProjectDialog
                  projectId={projectId}
                  projectName={project.name}
                  onDeleted={() => router.replace("/dashboard/projects")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
      )
}
