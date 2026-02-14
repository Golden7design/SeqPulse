"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { IconChevronLeft } from "@tabler/icons-react"
import { toast } from "sonner"

import { useTranslation } from "@/components/providers/i18n-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createProject } from "@/lib/projects-client"

type ProjectForm = {
  name: string
  description: string
  env: "prod" | "staging" | "dev"
  stack: "node" | "python" | "go" | "other"
}

export default function NewProjectPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [step, setStep] = useState<1 | 2>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [projectData, setProjectData] = useState<ProjectForm>({
    name: "",
    description: "",
    env: "prod",
    stack: "node",
  })

  const canProceedStep1 = projectData.name.trim().length > 0
  const stepLabel = t("projects.new.step")
    .replace("{step}", String(step))
    .replace("{total}", "2")

  const envLabel = t(`projects.new.environment.${projectData.env}`)
  const stackLabel = t(`projects.new.stack.${projectData.stack}`)

  const handleCreate = async () => {
    if (!canProceedStep1) return
    setFormError(null)
    setIsSubmitting(true)

    try {
      const created = await createProject({
        name: projectData.name.trim(),
        description: projectData.description.trim() || undefined,
        tech_stack: projectData.stack,
        envs: [projectData.env],
      })

      toast.success(`Project ${created.id} created`)
      router.push("/dashboard/projects")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create project."
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
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
          <p className="text-muted-foreground text-sm">{stepLabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {[1, 2].map((num) => (
          <div key={num} className="flex flex-1 items-center">
            <div
              className={`h-2 flex-1 rounded-full transition-colors ${
                num <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          </div>
        ))}
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("projects.new.sections.projectInfo.title")}</CardTitle>
            <CardDescription>{t("projects.new.sections.projectInfo.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="project-name">
                {t("projects.new.fields.projectName.label")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-name"
                placeholder={t("projects.new.fields.projectName.placeholder")}
                value={projectData.name}
                onChange={(event) => setProjectData({ ...projectData, name: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Input
                id="project-description"
                placeholder="Optional"
                value={projectData.description}
                onChange={(event) => setProjectData({ ...projectData, description: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment">
                {t("projects.new.fields.environment.label")} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={projectData.env}
                onValueChange={(value: ProjectForm["env"]) =>
                  setProjectData({ ...projectData, env: value })
                }
              >
                <SelectTrigger id="environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prod">{t("projects.new.environment.prod")}</SelectItem>
                  <SelectItem value="staging">{t("projects.new.environment.staging")}</SelectItem>
                  <SelectItem value="dev">Dev</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tech-stack">
                {t("projects.new.fields.techStack.label")} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={projectData.stack}
                onValueChange={(value: ProjectForm["stack"]) =>
                  setProjectData({ ...projectData, stack: value })
                }
              >
                <SelectTrigger id="tech-stack">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="node">{t("projects.new.stack.node")}</SelectItem>
                  <SelectItem value="python">{t("projects.new.stack.python")}</SelectItem>
                  <SelectItem value="go">{t("projects.new.stack.go")}</SelectItem>
                  <SelectItem value="other">{t("projects.new.stack.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                {t("projects.new.actions.next")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">{t("projects.new.review.title")}</h2>
            <p className="text-muted-foreground text-sm">{t("projects.new.review.subtitle")}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("projects.new.sections.projectInfo.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("projects.new.fields.projectName.label")}</p>
                  <p className="font-medium">{projectData.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("projects.new.fields.environment.label")}</p>
                  <Badge variant="outline" className="capitalize">
                    {envLabel}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm">{projectData.description || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("projects.new.fields.techStack.label")}</p>
                  <Badge variant="secondary" className="capitalize">
                    {stackLabel}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>
              {t("projects.new.actions.back")}
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : t("projects.new.actions.create")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
