"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { IconCheck, IconX } from "@tabler/icons-react"
import { toast } from "sonner"

import { AuthGate } from "@/components/auth-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { projectNameToPathSegment } from "@/lib/deployment-format"
import {
  clearNewProjectDraft,
  createProject,
  readNewProjectDraft,
  type NewProjectDraft,
} from "@/lib/projects-client"

type PlanId = "free" | "pro"

type PlanDefinition = {
  id: PlanId
  name: string
  price: string
  description: string
  badge?: string
  features: Array<{ label: string; included: boolean }>
}

const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    price: "$0/mois",
    description: "Pour tester SeqPulse et les petits projets.",
    features: [
      { label: "15 deployements/mois", included: true },
      { label: "Observation Window: 5 minutes", included: true },
      { label: "SDH (Seqpulse Diagnostic Hints)", included: false },
      { label: "Retention metrics: 7 jours", included: true },
      { label: "Alertes email", included: true },
      { label: "Alertes Slack", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49/mois",
    description: "Pour les equipes serieuses en production.",
    badge: "Recommande",
    features: [
      { label: "Deployements illimites", included: true },
      { label: "Observation Window: 30 minutes", included: true },
      { label: "SDH (Seqpulse Diagnostic Hints) active", included: true },
      { label: "Retention metrics: 30 jours", included: true },
      { label: "Alertes email", included: true },
      { label: "Alertes Slack", included: true },
    ],
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<NewProjectDraft | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(true)
  const [submittingPlan, setSubmittingPlan] = useState<PlanId | null>(null)

  useEffect(() => {
    const savedDraft = readNewProjectDraft()
    setDraft(savedDraft)
    setLoadingDraft(false)
  }, [])

  const handleSelectPlan = async (plan: PlanId) => {
    if (!draft || submittingPlan) return

    setSubmittingPlan(plan)
    try {
      const created = await createProject({
        ...draft,
        plan,
      })
      clearNewProjectDraft()
      toast.success(`Project ${created.id} created with ${plan.toUpperCase()} plan`)
      router.push(`/dashboard/projects/${projectNameToPathSegment(created.name)}?tab=integration`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Project creation failed."
      toast.error(message)
    } finally {
      setSubmittingPlan(null)
    }
  }

  return (
    <AuthGate>
        <main className="min-h-screen bg-background p-4 md:p-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-satoshi" >Choose a plan for this project</CardTitle>
                <CardDescription>
                  Paiement non integre pour le moment: la selection applique directement le plan du projet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDraft ? (
                  <p className="text-sm text-muted-foreground">Loading project draft...</p>
                ) : !draft ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Aucun brouillon de projet trouve. Reviens au formulaire pour continuer.
                    </p>
                    <Button onClick={() => router.push("/dashboard/projects/new")}>
                      Back to project form
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Project:</span> {draft.name}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Environment:</span> {draft.envs.join(", ")}
                    </p>
                    <p className="break-all">
                      <span className="font-medium text-foreground">Metrics endpoint:</span>{" "}
                      {draft.metrics_endpoint}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {PLAN_DEFINITIONS.map((plan) => (
                <Card key={plan.id} className={plan.id === "pro" ? "border-primary" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{plan.name}</CardTitle>
                      {plan.badge ? <Badge>{plan.badge}</Badge> : null}
                    </div>
                    <p className="text-2xl font-semibold">{plan.price}</p>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature.label} className="flex items-center gap-2 text-sm">
                          {feature.included ? (
                            <IconCheck className="size-4 text-green-600" />
                          ) : (
                            <IconX className="size-4 text-muted-foreground" />
                          )}
                          <span className={feature.included ? "text-foreground" : "text-muted-foreground"}>
                            {feature.label}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      variant={plan.id === "pro" ? "default" : "outline"}
                      disabled={!draft || !!submittingPlan}
                      onClick={() => handleSelectPlan(plan.id)}
                    >
                      {submittingPlan === plan.id ? "Creating project..." : `Choose ${plan.name}`}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
    </AuthGate>
  )
}
