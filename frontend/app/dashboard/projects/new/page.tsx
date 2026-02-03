"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconCheck, IconChevronLeft } from "@tabler/icons-react"
import { useTranslation } from "@/components/providers/i18n-provider"

type Plan = {
  id: string
  nameKey: string
  price: string
  priceKey?: string
  limits: {
    deployments_per_month: number | string
    diagnostics: string
    retention_days: number
    can_change_endpoint: boolean
  }
}

const plans: Plan[] = [
  {
    id: "free",
    nameKey: "projects.new.plan.tiers.free.name",
    price: "0$",
    limits: {
      deployments_per_month: 10,
      diagnostics: "basic",
      retention_days: 1,
      can_change_endpoint: false
    }
  },
  {
    id: "pro",
    nameKey: "projects.new.plan.tiers.pro.name",
    price: "19$",
    limits: {
      deployments_per_month: 100,
      diagnostics: "advanced",
      retention_days: 30,
      can_change_endpoint: true
    }
  },
  {
    id: "enterprise",
    nameKey: "projects.new.plan.tiers.enterprise.name",
    price: "",
    priceKey: "projects.new.plan.priceCustom",
    limits: {
      deployments_per_month: "unlimited",
      diagnostics: "full",
      retention_days: 90,
      can_change_endpoint: true
    }
  }
]

export default function NewProjectPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const totalSteps = 3
  const [projectData, setProjectData] = useState({
    name: "",
    env: "prod",
    metricsEndpoint: "",
    stack: "node"
  })
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = () => {
    // Simulate project creation
    const newProject = {
      id: "prj_2",
      name: projectData.name,
      env: projectData.env,
      metrics_endpoint: projectData.metricsEndpoint,
      stack: projectData.stack,
      plan: selectedPlan,
      api_key: "SP_live_xxx123",
      baseline_ready: false
    }

    console.log("Project created:", newProject)
    
    // Rediriger vers la page du projet avec l'onglet settings actif
    router.push(`/dashboard/projects/prj_2?tab=settings`)
  }

  const canProceedStep1 = projectData.name && projectData.metricsEndpoint
  const canProceedStep2 = selectedPlan !== null
  const stepLabel = t("projects.new.step")
    .replace("{step}", String(step))
    .replace("{total}", String(totalSteps))
  const metricsEndpointHelp = t("projects.new.fields.metricsEndpoint.help")
  const envLabel = t(`projects.new.environment.${projectData.env}`)
  const stackLabel = t(`projects.new.stack.${projectData.stack}`)
  const selectedPlanData = plans.find((plan) => plan.id === selectedPlan)
  const selectedPlanName = selectedPlanData ? t(selectedPlanData.nameKey) : ""
  const selectedPlanPrice = selectedPlanData
    ? selectedPlanData.priceKey
      ? t(selectedPlanData.priceKey)
      : selectedPlanData.price
    : ""
  const selectedPlanDeployments = selectedPlanData
    ? typeof selectedPlanData.limits.deployments_per_month === "string"
      ? t(`projects.new.plan.limits.${selectedPlanData.limits.deployments_per_month}`)
      : selectedPlanData.limits.deployments_per_month
    : ""
  const selectedPlanDiagnostics = selectedPlanData
    ? t(`projects.new.plan.diagnostics.${selectedPlanData.limits.diagnostics}`)
    : ""
  const selectedPlanRetention = selectedPlanData
    ? t("projects.new.plan.retentionDays").replace(
        "{days}",
        String(selectedPlanData.limits.retention_days)
      )
    : ""

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/projects")}
        >
          <IconChevronLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("projects.new.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {stepLabel}
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, index) => index + 1).map((num) => (
          <div key={num} className="flex items-center flex-1">
            <div
              className={`h-2 rounded-full flex-1 transition-colors ${
                num <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Step 1: Project Form */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("projects.new.sections.projectInfo.title")}</CardTitle>
            <CardDescription>
              {t("projects.new.sections.projectInfo.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="project-name">
                {t("projects.new.fields.projectName.label")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-name"
                placeholder={t("projects.new.fields.projectName.placeholder")}
                value={projectData.name}
                onChange={(e) =>
                  setProjectData({ ...projectData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment">
                {t("projects.new.fields.environment.label")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={projectData.env}
                onValueChange={(value) =>
                  setProjectData({ ...projectData, env: value })
                }
              >
                <SelectTrigger id="environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prod">
                    {t("projects.new.environment.prod")}
                  </SelectItem>
                  <SelectItem value="staging">
                    {t("projects.new.environment.staging")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metrics-endpoint">
                {t("projects.new.fields.metricsEndpoint.label")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="metrics-endpoint"
                placeholder={t("projects.new.fields.metricsEndpoint.placeholder")}
                value={projectData.metricsEndpoint}
                onChange={(e) =>
                  setProjectData({
                    ...projectData,
                    metricsEndpoint: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                {metricsEndpointHelp}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tech-stack">
                {t("projects.new.fields.techStack.label")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={projectData.stack}
                onValueChange={(value) =>
                  setProjectData({ ...projectData, stack: value })
                }
              >
                <SelectTrigger id="tech-stack">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="node">
                    {t("projects.new.stack.node")}
                  </SelectItem>
                  <SelectItem value="python">
                    {t("projects.new.stack.python")}
                  </SelectItem>
                  <SelectItem value="go">
                    {t("projects.new.stack.go")}
                  </SelectItem>
                  <SelectItem value="other">
                    {t("projects.new.stack.other")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                onClick={handleNext}
                disabled={!canProceedStep1}
              >
                {t("projects.new.actions.next")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Choose Plan */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">{t("projects.new.plan.title")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("projects.new.plan.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`cursor-pointer transition-all ${
                  selectedPlan === plan.id
                    ? "border-primary ring-2 ring-primary/20"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{t(plan.nameKey)}</CardTitle>
                      <CardDescription className="text-2xl font-bold mt-2">
                        {plan.priceKey ? t(plan.priceKey) : plan.price}
                        {!plan.priceKey && (
                          <span className="text-sm font-normal">
                            {t("projects.new.plan.perMonth")}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    {selectedPlan === plan.id && (
                      <div className="bg-primary text-primary-foreground rounded-full p-1">
                        <IconCheck className="size-4" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t("projects.new.plan.labels.deploymentsPerMonth")}
                      </span>
                      <span className="font-medium">
                        {typeof plan.limits.deployments_per_month === "string"
                          ? t(`projects.new.plan.limits.${plan.limits.deployments_per_month}`)
                          : plan.limits.deployments_per_month}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t("projects.new.plan.labels.diagnostics")}
                      </span>
                      <Badge variant="secondary" className="capitalize">
                        {t(`projects.new.plan.diagnostics.${plan.limits.diagnostics}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t("projects.new.plan.labels.retention")}
                      </span>
                      <span className="font-medium">
                        {t("projects.new.plan.retentionDays").replace(
                          "{days}",
                          String(plan.limits.retention_days)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t("projects.new.plan.labels.changeEndpoint")}
                      </span>
                      <span className="font-medium">
                        {plan.limits.can_change_endpoint
                          ? t("projects.new.common.yes")
                          : t("projects.new.common.no")}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              {t("projects.new.actions.back")}
            </Button>
            <Button onClick={handleNext} disabled={!canProceedStep2}>
              {t("projects.new.actions.next")}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Overview */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">{t("projects.new.review.title")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("projects.new.review.subtitle")}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("projects.new.sections.projectInfo.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("projects.new.fields.projectName.label")}
                  </p>
                  <p className="font-medium">{projectData.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("projects.new.fields.environment.label")}
                  </p>
                  <Badge variant="outline" className="capitalize">
                    {envLabel}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">
                    {t("projects.new.fields.metricsEndpoint.label")}
                  </p>
                  <p className="font-mono text-sm break-all">
                    {projectData.metricsEndpoint}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("projects.new.fields.techStack.label")}
                  </p>
                  <Badge variant="secondary" className="capitalize">
                    {stackLabel}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("projects.new.plan.selectedTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedPlan && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {selectedPlanName}
                    </span>
                    <span className="text-xl font-bold">
                      {selectedPlanPrice}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t("projects.new.plan.labels.deploymentsPerMonth")}
                      </span>
                      <span className="font-medium">
                        {selectedPlanDeployments}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t("projects.new.plan.labels.diagnostics")}
                      </span>
                      <Badge variant="secondary" className="capitalize">
                        {selectedPlanDiagnostics}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t("projects.new.plan.labels.retention")}
                      </span>
                      <span className="font-medium">
                        {selectedPlanRetention}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              {t("projects.new.actions.back")}
            </Button>
            <Button onClick={handleSubmit}>
              {t("projects.new.actions.create")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
