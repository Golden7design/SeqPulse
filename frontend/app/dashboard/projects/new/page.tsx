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

type Plan = {
  id: string
  name: string
  price: string
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
    name: "Free",
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
    name: "Pro",
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
    name: "Enterprise",
    price: "Custom",
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
  const [step, setStep] = useState(1)
  const [projectData, setProjectData] = useState({
    name: "",
    env: "prod",
    metricsEndpoint: "",
    stack: "node"
  })
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
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
          <h1 className="text-2xl font-bold">Create New Project</h1>
          <p className="text-muted-foreground text-sm">
            Step {step} of 3
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((num) => (
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
            <CardTitle>Project Information</CardTitle>
            <CardDescription>
              Configure your project settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="project-name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-name"
                placeholder="my-api"
                value={projectData.name}
                onChange={(e) =>
                  setProjectData({ ...projectData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment">
                Environment <span className="text-destructive">*</span>
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
                  <SelectItem value="prod">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metrics-endpoint">
                Metrics Endpoint URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="metrics-endpoint"
                placeholder="https://api.example.com/ds-metrics"
                value={projectData.metricsEndpoint}
                onChange={(e) =>
                  setProjectData({
                    ...projectData,
                    metricsEndpoint: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                A project represents one application. The metrics endpoint can
                be updated later, but changing it will reset baseline metrics.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tech-stack">
                Tech Stack <span className="text-destructive">*</span>
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
                  <SelectItem value="node">Node.js</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="go">Go</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                onClick={handleNext}
                disabled={!canProceedStep1}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Choose Plan */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Choose a Plan</h2>
            <p className="text-muted-foreground text-sm">
              Select the plan that fits your needs
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
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription className="text-2xl font-bold mt-2">
                        {plan.price}
                        {plan.price !== "Custom" && <span className="text-sm font-normal">/month</span>}
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
                      <span className="text-muted-foreground">Deployments/month</span>
                      <span className="font-medium">
                        {plan.limits.deployments_per_month}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Diagnostics</span>
                      <Badge variant="secondary" className="capitalize">
                        {plan.limits.diagnostics}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Retention</span>
                      <span className="font-medium">
                        {plan.limits.retention_days} days
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Change endpoint</span>
                      <span className="font-medium">
                        {plan.limits.can_change_endpoint ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleNext} disabled={!canProceedStep2}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Overview */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Review & Confirm</h2>
            <p className="text-muted-foreground text-sm">
              Please review your project configuration
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Project Name</p>
                  <p className="font-medium">{projectData.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Environment</p>
                  <Badge variant="outline" className="capitalize">
                    {projectData.env}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Metrics Endpoint</p>
                  <p className="font-mono text-sm break-all">
                    {projectData.metricsEndpoint}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tech Stack</p>
                  <Badge variant="secondary" className="capitalize">
                    {projectData.stack}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selected Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedPlan && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {plans.find((p) => p.id === selectedPlan)?.name}
                    </span>
                    <span className="text-xl font-bold">
                      {plans.find((p) => p.id === selectedPlan)?.price}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Deployments/month</span>
                      <span className="font-medium">
                        {plans.find((p) => p.id === selectedPlan)?.limits.deployments_per_month}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Diagnostics</span>
                      <Badge variant="secondary" className="capitalize">
                        {plans.find((p) => p.id === selectedPlan)?.limits.diagnostics}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Retention</span>
                      <span className="font-medium">
                        {plans.find((p) => p.id === selectedPlan)?.limits.retention_days} days
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleSubmit}>
              Create Project
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}