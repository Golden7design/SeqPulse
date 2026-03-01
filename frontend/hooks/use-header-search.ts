"use client"

import * as React from "react"
import {
  listDeployments,
  listProjects,
  listSDH,
  type DeploymentDashboard,
  type ProjectDashboard,
  type SDHItem,
} from "@/lib/dashboard-client"
import { projectNameToPathSegment } from "@/lib/deployment-format"

const SEARCH_MAX_RESULTS = 7
const LIVE_ANALYZED_GRACE_MS = 15_000
const POLLING_INTERVAL_MS = 5_000
const QUERY_DEBOUNCE_MS = 180

type ResultGroup = "live" | "risk" | "navigation" | "history"
type ResultKind = "live_deployment" | "deployment" | "project" | "diagnostic" | "navigation"

export type HeaderSearchResult = {
  id: string
  kind: ResultKind
  group: ResultGroup
  title: string
  subtitle: string
  href: string
  score: number
  timestampMs: number
}

export type HeaderSearchSection = {
  group: ResultGroup
  label: string
  items: HeaderSearchResult[]
}

type SearchSnapshot = {
  projects: ProjectDashboard[]
  deployments: DeploymentDashboard[]
  diagnostics: SDHItem[]
  fetchedAtMs: number
}

type QueryFilters = {
  state: DeploymentDashboard["state"] | null
  verdict: "ok" | "warning" | "rollback_recommended" | null
  project: string | null
  freeTerms: string[]
  deploymentIdExact: string | null
}

const GROUP_LABELS: Record<ResultGroup, string> = {
  live: "Live",
  risk: "Risk",
  navigation: "Go To",
  history: "History",
}

let snapshotCache: SearchSnapshot | null = null

function normalizeVerdictToken(value: string): QueryFilters["verdict"] {
  if (value === "rollback" || value === "rollback_recommended") {
    return "rollback_recommended"
  }
  if (value === "warning") return "warning"
  if (value === "ok") return "ok"
  return null
}

function parseQuery(rawQuery: string): QueryFilters {
  const normalized = rawQuery.trim().toLowerCase()
  if (!normalized) {
    return {
      state: null,
      verdict: null,
      project: null,
      freeTerms: [],
      deploymentIdExact: null,
    }
  }

  const tokenRegex = /(\w+):([^\s]+)/g
  let match: RegExpExecArray | null
  let state: QueryFilters["state"] = null
  let verdict: QueryFilters["verdict"] = null
  let project: string | null = null
  const consumedTokens = new Set<string>()

  while ((match = tokenRegex.exec(normalized)) !== null) {
    const key = match[1]
    const value = match[2]
    consumedTokens.add(match[0])
    if (key === "state" && (value === "pending" || value === "running" || value === "finished" || value === "analyzed")) {
      state = value
    } else if (key === "verdict") {
      verdict = normalizeVerdictToken(value)
    } else if (key === "project") {
      project = value
    }
  }

  let remaining = normalized
  for (const token of consumedTokens) {
    remaining = remaining.replace(token, " ")
  }

  const freeTerms = remaining
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  const deploymentIdExact = /dpl_\d+/.test(normalized) ? normalized.match(/dpl_\d+/)?.[0] ?? null : null

  return { state, verdict, project, freeTerms, deploymentIdExact }
}

function scoreTextMatch(text: string, terms: string[]): number {
  if (terms.length === 0) return 0
  const normalizedText = text.toLowerCase()
  let score = 0
  for (const term of terms) {
    if (normalizedText === term) {
      score += 20
      continue
    }
    if (normalizedText.startsWith(term) || normalizedText.includes(` ${term}`)) {
      score += 20
      continue
    }
    if (normalizedText.includes(term)) {
      score += 10
    }
  }
  return score
}

function toAgePenalty(timestampMs: number): number {
  if (timestampMs <= 0) return 0
  const ageMinutes = Math.max(0, (Date.now() - timestampMs) / 60_000)
  return Math.min(40, Math.floor(ageMinutes * 0.5))
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function matchesProjectFilter(projectName: string, projectFilter: string | null): boolean {
  if (!projectFilter) return true
  return projectName.toLowerCase().includes(projectFilter)
}

function matchesVerdictFilter(
  verdict: "ok" | "warning" | "rollback_recommended",
  verdictFilter: QueryFilters["verdict"]
): boolean {
  if (!verdictFilter) return true
  return verdict === verdictFilter
}

function buildNavigationResults(filters: QueryFilters): HeaderSearchResult[] {
  const entries = [
    { id: "goto-dashboard", title: "Dashboard", href: "/dashboard", subtitle: "Open overview" },
    { id: "goto-projects", title: "Projects", href: "/dashboard/projects", subtitle: "Open projects list" },
    { id: "goto-deployments", title: "Deployments", href: "/dashboard/deployments", subtitle: "Open deployments list" },
    { id: "goto-sdh", title: "SDH", href: "/dashboard/SDH", subtitle: "Open diagnostics" },
    { id: "goto-settings", title: "Settings", href: "/dashboard/settings", subtitle: "Open account settings" },
  ]

  return entries
    .map((entry) => {
      const score = scoreTextMatch(`${entry.title} ${entry.subtitle}`, filters.freeTerms)
      return {
        id: entry.id,
        kind: "navigation" as const,
        group: "navigation" as const,
        title: entry.title,
        subtitle: entry.subtitle,
        href: entry.href,
        score,
        timestampMs: 0,
      }
    })
    .filter((item) => filters.freeTerms.length === 0 || item.score > 0)
}

function buildLiveResults(
  deployments: DeploymentDashboard[],
  filters: QueryFilters
): HeaderSearchResult[] {
  return deployments
    .filter((deployment) => {
      if (!matchesProjectFilter(deployment.project, filters.project)) return false
      if (filters.state && deployment.state !== filters.state) return false
      if (!matchesVerdictFilter(deployment.verdict.verdict, filters.verdict)) return false

      const isActiveCycle =
        deployment.state === "pending" ||
        deployment.state === "running" ||
        deployment.state === "finished" ||
        (deployment.state === "analyzed" &&
          (() => {
            const analyzedAtMs = parseTimestamp(deployment.finished_at || deployment.started_at)
            return analyzedAtMs > 0 && Date.now() - analyzedAtMs <= LIVE_ANALYZED_GRACE_MS
          })())
      if (!isActiveCycle) return false

      if (filters.deploymentIdExact) {
        return deployment.public_id.toLowerCase() === filters.deploymentIdExact
      }

      const searchText = `${deployment.public_id} ${deployment.project} ${deployment.env} ${deployment.state} ${deployment.verdict.verdict}`
      return filters.freeTerms.length === 0 || scoreTextMatch(searchText, filters.freeTerms) > 0
    })
    .map((deployment) => {
      const baseScore = 100 + (deployment.verdict.verdict === "rollback_recommended" || deployment.verdict.verdict === "warning" ? 70 : 0)
      const exactIdBonus = filters.deploymentIdExact && deployment.public_id.toLowerCase() === filters.deploymentIdExact ? 40 : 0
      const searchText = `${deployment.public_id} ${deployment.project} ${deployment.env} ${deployment.state} ${deployment.verdict.verdict}`
      const textScore = scoreTextMatch(searchText, filters.freeTerms)
      const timestampMs = parseTimestamp(deployment.finished_at || deployment.started_at)
      const score = baseScore + exactIdBonus + textScore - toAgePenalty(timestampMs)

      return {
        id: `live-${deployment.internal_id}`,
        kind: "live_deployment" as const,
        group: "live" as const,
        title: `${deployment.public_id} • ${deployment.project}`,
        subtitle: `${deployment.env} • ${deployment.state} • ${deployment.verdict.verdict}`,
        href: `/dashboard/deployments/${projectNameToPathSegment(deployment.project)}/${deployment.internal_id}`,
        score,
        timestampMs,
      }
    })
    .sort((a, b) => b.score - a.score || b.timestampMs - a.timestampMs)
}

function buildRiskResults(
  deployments: DeploymentDashboard[],
  diagnostics: SDHItem[],
  filters: QueryFilters
): HeaderSearchResult[] {
  const riskyDeployments = deployments
    .filter((deployment) => {
      if (!matchesProjectFilter(deployment.project, filters.project)) return false
      if (filters.state && deployment.state !== filters.state) return false
      if (!matchesVerdictFilter(deployment.verdict.verdict, filters.verdict)) return false
      if (!(deployment.verdict.verdict === "warning" || deployment.verdict.verdict === "rollback_recommended")) return false

      if (filters.deploymentIdExact) {
        return deployment.public_id.toLowerCase() === filters.deploymentIdExact
      }
      const searchText = `${deployment.public_id} ${deployment.project} ${deployment.env} ${deployment.state} ${deployment.verdict.verdict}`
      return filters.freeTerms.length === 0 || scoreTextMatch(searchText, filters.freeTerms) > 0
    })
    .map((deployment) => {
      const baseScore = 70
      const exactIdBonus = filters.deploymentIdExact && deployment.public_id.toLowerCase() === filters.deploymentIdExact ? 40 : 0
      const searchText = `${deployment.public_id} ${deployment.project} ${deployment.env} ${deployment.state} ${deployment.verdict.verdict}`
      const textScore = scoreTextMatch(searchText, filters.freeTerms)
      const timestampMs = parseTimestamp(deployment.finished_at || deployment.started_at)
      return {
        id: `risk-deployment-${deployment.internal_id}`,
        kind: "deployment" as const,
        group: "risk" as const,
        title: `${deployment.public_id} • ${deployment.project}`,
        subtitle: `${deployment.verdict.verdict} • ${deployment.env}`,
        href: `/dashboard/deployments/${projectNameToPathSegment(deployment.project)}/${deployment.internal_id}`,
        score: baseScore + exactIdBonus + textScore - toAgePenalty(timestampMs),
        timestampMs,
      }
    })

  const riskyDiagnostics = diagnostics
    .filter((diagnostic) => {
      if (!matchesProjectFilter(diagnostic.project, filters.project)) return false
      if (filters.verdict === "ok") return false
      if (filters.verdict === "rollback_recommended" && diagnostic.severity !== "critical") return false
      if (filters.verdict === "warning" && diagnostic.severity !== "warning") return false
      if (!(diagnostic.severity === "critical" || diagnostic.severity === "warning")) return false
      const searchText = `${diagnostic.project} ${diagnostic.metric} ${diagnostic.title} ${diagnostic.severity} ${diagnostic.env}`
      return filters.freeTerms.length === 0 || scoreTextMatch(searchText, filters.freeTerms) > 0
    })
    .map((diagnostic) => {
      const baseScore = diagnostic.severity === "critical" ? 70 : 60
      const searchText = `${diagnostic.project} ${diagnostic.metric} ${diagnostic.title} ${diagnostic.severity} ${diagnostic.env}`
      const textScore = scoreTextMatch(searchText, filters.freeTerms)
      const timestampMs = parseTimestamp(diagnostic.created_at)
      return {
        id: `risk-diagnostic-${diagnostic.id}`,
        kind: "diagnostic" as const,
        group: "risk" as const,
        title: `${diagnostic.project} • ${diagnostic.title}`,
        subtitle: `${diagnostic.severity} • ${diagnostic.metric}`,
        href: "/dashboard/SDH",
        score: baseScore + textScore - toAgePenalty(timestampMs),
        timestampMs,
      }
    })

  return [...riskyDeployments, ...riskyDiagnostics].sort(
    (a, b) => b.score - a.score || b.timestampMs - a.timestampMs
  )
}

function buildHistoryResults(
  projects: ProjectDashboard[],
  deployments: DeploymentDashboard[],
  filters: QueryFilters
): HeaderSearchResult[] {
  const projectItems = projects
    .filter((project) => {
      if (!matchesProjectFilter(project.name, filters.project)) return false
      const searchText = `${project.name} ${project.env} ${project.plan} ${project.stack.join(" ")}`
      return filters.freeTerms.length === 0 || scoreTextMatch(searchText, filters.freeTerms) > 0
    })
    .map((project) => {
      const searchText = `${project.name} ${project.env} ${project.plan} ${project.stack.join(" ")}`
      const textScore = scoreTextMatch(searchText, filters.freeTerms)
      const timestampMs = parseTimestamp(project.created_at)
      return {
        id: `history-project-${project.internal_id}`,
        kind: "project" as const,
        group: "history" as const,
        title: project.name,
        subtitle: `${project.env} • ${project.plan}`,
        href: `/dashboard/projects/${projectNameToPathSegment(project.name)}`,
        score: textScore - toAgePenalty(timestampMs),
        timestampMs,
      }
    })

  const deploymentItems = deployments
    .filter((deployment) => {
      if (!matchesProjectFilter(deployment.project, filters.project)) return false
      if (filters.state && deployment.state !== filters.state) return false
      if (!matchesVerdictFilter(deployment.verdict.verdict, filters.verdict)) return false
      if (filters.deploymentIdExact) {
        return deployment.public_id.toLowerCase() === filters.deploymentIdExact
      }
      const searchText = `${deployment.public_id} ${deployment.project} ${deployment.env} ${deployment.state} ${deployment.verdict.verdict}`
      return filters.freeTerms.length === 0 || scoreTextMatch(searchText, filters.freeTerms) > 0
    })
    .map((deployment) => {
      const riskScore = deployment.verdict.verdict === "rollback_recommended" || deployment.verdict.verdict === "warning" ? 70 : 0
      const exactIdBonus = filters.deploymentIdExact && deployment.public_id.toLowerCase() === filters.deploymentIdExact ? 40 : 0
      const searchText = `${deployment.public_id} ${deployment.project} ${deployment.env} ${deployment.state} ${deployment.verdict.verdict}`
      const textScore = scoreTextMatch(searchText, filters.freeTerms)
      const timestampMs = parseTimestamp(deployment.finished_at || deployment.started_at)
      return {
        id: `history-deployment-${deployment.internal_id}`,
        kind: "deployment" as const,
        group: "history" as const,
        title: `${deployment.public_id} • ${deployment.project}`,
        subtitle: `${deployment.verdict.verdict} • ${deployment.env}`,
        href: `/dashboard/deployments/${projectNameToPathSegment(deployment.project)}/${deployment.internal_id}`,
        score: riskScore + exactIdBonus + textScore - toAgePenalty(timestampMs),
        timestampMs,
      }
    })

  return [...deploymentItems, ...projectItems].sort((a, b) => b.score - a.score || b.timestampMs - a.timestampMs)
}

function uniqueById(items: HeaderSearchResult[]): HeaderSearchResult[] {
  const seen = new Set<string>()
  const out: HeaderSearchResult[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

function toResourceKey(item: HeaderSearchResult): string {
  return `${item.href}|${item.title}`
}

function limitSections(sections: HeaderSearchSection[]): HeaderSearchSection[] {
  const out: HeaderSearchSection[] = []
  let remaining = SEARCH_MAX_RESULTS

  for (const section of sections) {
    if (remaining <= 0) break
    const trimmed = section.items.slice(0, remaining)
    if (trimmed.length > 0) {
      out.push({ ...section, items: trimmed })
      remaining -= trimmed.length
    }
  }
  return out
}

async function fetchSnapshot(): Promise<SearchSnapshot> {
  const [projects, deployments, diagnostics] = await Promise.all([
    listProjects(),
    listDeployments(),
    listSDH({ limit: 60 }),
  ])
  return { projects, deployments, diagnostics, fetchedAtMs: Date.now() }
}

export function useHeaderSearch({ query, isOpen }: { query: string; isOpen: boolean }) {
  const [snapshot, setSnapshot] = React.useState<SearchSnapshot | null>(snapshotCache)
  const [loading, setLoading] = React.useState(!snapshotCache)
  const [debouncedQuery, setDebouncedQuery] = React.useState(query)

  React.useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), QUERY_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [query])

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const next = await fetchSnapshot()
        if (cancelled) return
        snapshotCache = next
        setSnapshot(next)
      } catch {
        if (cancelled) return
        if (snapshotCache) {
          setSnapshot(snapshotCache)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    if (!isOpen) return () => {
      cancelled = true
    }

    const interval = window.setInterval(() => {
      void load()
    }, POLLING_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [isOpen])

  const sections = React.useMemo<HeaderSearchSection[]>(() => {
    const filters = parseQuery(debouncedQuery)

    const navResults = buildNavigationResults(filters)
    const liveResults = snapshot ? buildLiveResults(snapshot.deployments, filters) : []
    const riskResults = snapshot ? buildRiskResults(snapshot.deployments, snapshot.diagnostics, filters) : []
    const historyResults = snapshot ? buildHistoryResults(snapshot.projects, snapshot.deployments, filters) : []

    const dedupedLive = uniqueById(liveResults)
    const liveResourceKeys = new Set(dedupedLive.map(toResourceKey))
    const dedupedRisk = uniqueById(
      riskResults.filter((item) => !liveResourceKeys.has(toResourceKey(item)))
    )
    const riskResourceKeys = new Set(dedupedRisk.map(toResourceKey))
    const dedupedHistory = uniqueById(
      historyResults.filter(
        (item) =>
          !liveResourceKeys.has(toResourceKey(item)) &&
          !riskResourceKeys.has(toResourceKey(item))
      )
    )
    const dedupedNav = uniqueById(navResults)

    const ordered: HeaderSearchSection[] = [
      { group: "live", label: GROUP_LABELS.live, items: dedupedLive },
      { group: "risk", label: GROUP_LABELS.risk, items: dedupedRisk },
      { group: "navigation", label: GROUP_LABELS.navigation, items: dedupedNav },
      { group: "history", label: GROUP_LABELS.history, items: dedupedHistory },
    ]
    const nonEmptySections = ordered.filter((section) => section.items.length > 0)
    return limitSections(nonEmptySections)
  }, [debouncedQuery, snapshot])

  const flatResults = React.useMemo(() => sections.flatMap((section) => section.items), [sections])

  return {
    loading,
    sections,
    flatResults,
    debouncedQuery,
    hasData: Boolean(snapshot),
  }
}
