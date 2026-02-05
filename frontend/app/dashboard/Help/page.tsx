import {
  IconActivityHeartbeat,
  IconAlertTriangle,
  IconBrandGithubFilled,
  IconCircleCheckFilled,
  IconHelp,
  IconInfoCircle,
  IconKey,
  IconMail,
  IconRotateClockwise2,
  IconShield,
  IconWorld,
  IconCheck,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const mentalModel = [
  {
    title: "1. Collect signals",
    description:
      "SeqPulse listens to deployment events and pulls the key metrics you already trust.",
    icon: IconActivityHeartbeat,
  },
  {
    title: "2. Compare windows",
    description:
      "We compare pre-release vs post-release windows and baseline behavior.",
    icon: IconInfoCircle,
  },
  {
    title: "3. Decide with confidence",
    description:
      "You get a clear verdict and short hints explaining what changed.",
    icon: IconCircleCheckFilled,
  },
]

const verdicts = [
  {
    title: "OK",
    description:
      "Signals are within expected range. Keep the rollout going with confidence.",
    icon: IconCircleCheckFilled,
    tone: "text-green-600",
    bg: "bg-green-500/10 dark:bg-green-500/20",
  },
  {
    title: "Warning",
    description:
      "Some metrics drifted. Inspect SDH hints and validate traffic volume.",
    icon: IconAlertTriangle,
    tone: "text-orange-600",
    bg: "bg-orange-500/10 dark:bg-orange-500/20",
  },
  {
    title: "Rollback recommended",
    description:
      "High confidence regression detected. Pause or rollback to protect users.",
    icon: IconRotateClockwise2,
    tone: "text-red-600",
    bg: "bg-red-500/10 dark:bg-red-500/20",
  },
]

const quickStart = [
  "Set your metrics endpoint and API key in project settings.",
  "Send deployment events (version, env, timestamp).",
  "Review verdicts and SDH hints, then tune thresholds if needed.",
]

const faqs = [
  {
    question: 'I see "Metrics unavailable"',
    answer: "Check your metrics endpoint, credentials, and API key.",
  },
  {
    question: "My verdict is always Warning",
    answer: "Verify traffic volume, baseline quality, and thresholds.",
  },
  {
    question: "SDH are blurred (Free Plan)",
    answer: "Upgrade to see full diagnostic hints and suggestions.",
  },
  {
    question: "Verdict flips too often",
    answer: "Increase window size or set stronger minimum sample counts.",
  },
]

const links = [
  {
    title: "Documentation",
    description: "Deep dive guides and API references (coming soon).",
    icon: IconHelp,
  },
  {
    title: "Test your integration",
    description: "Validate events, metrics, and signatures in a sandbox.",
    icon: IconActivityHeartbeat,
  },
  {
    title: "Contact support",
    description: "Get help from a real human within 1 business day.",
    icon: IconMail,
  },
  {
    title: "GitHub",
    description: "SDKs, examples, and public roadmaps.",
    icon: IconBrandGithubFilled,
  },
  {
    title: "seqpulse.io",
    description: "Product updates and company info.",
    icon: IconWorld,
  },
]

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-18 py-6 md:py-10">
      {/* Header */}
      <div className="px-4 lg:px-6">
        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <IconHelp className="size-5" />
                  </div>
                  <Badge variant="outline">Help &amp; Getting Started</Badge>
                </div>
                <CardTitle className="text-2xl md:text-3xl">
                  Welcome to SeqPulse
                </CardTitle>
                <CardDescription className="max-w-2xl text-base">
                  SeqPulse helps teams ship with confidence by correlating
                  deployment changes and real metrics. You get a clear verdict,
                  actionable SDH hints, and a shared language for engineers and
                  leadership.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <a href="#">Read HMAC guide</a>
                </Button>
                <Button asChild>
                  <a href="#">Go to docs</a>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <IconCheck className="size-4 text-green-500" />
                  <h3 className="text-sm font-semibold">Quick start</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {quickStart.map((step, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-0.5 text-xs text-foreground font-mono">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconMail className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Contact point</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Need a hand with setup or a tough incident?
                </p>
                <p className="mt-2 text-sm font-medium">support@seqpulse.io</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How SeqPulse works */}
      <div className="px-4 lg:px-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">How SeqPulse works</h2>
          <p className="text-sm text-muted-foreground">
            A simple mental model to keep everyone aligned from junior devs to
            leadership.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {mentalModel.map((step) => (
            <Card key={step.title}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <step.icon className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base">{step.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Verdicts */}
      <div className="px-4 lg:px-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">SeqPulse understanding verdicts</h2>
          <p className="text-sm text-muted-foreground">
            Every deployment receives a verdict you can trust and explain.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {verdicts.map((verdict) => (
            <Card key={verdict.title} className={verdict.bg}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <verdict.icon className={`size-5 ${verdict.tone}`} />
                  <CardTitle className="text-base">{verdict.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {verdict.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Understanding SDH */}
      <div className="px-4 lg:px-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">
            Understanding SDH (SeqPulse Debug Hints)
          </h2>
          <p className="text-sm text-muted-foreground">
            SDH are short diagnostic hints that explain why a verdict changed,
            with concrete actions for the next step.
          </p>
        </div>
        <Card>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <IconActivityHeartbeat className="size-7 text-muted-foreground" />
                <p className="text-sm font-semibold">Signal context</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Metric name, observed value, baseline, and confidence score.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <IconInfoCircle className="size-7 text-muted-foreground" />
                <p className="text-sm font-semibold">Human explanation</p>
              </div>
              <p className="text-sm text-muted-foreground">
                A plain-language summary of what changed and why it matters.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <IconAlertTriangle className="size-7 text-muted-foreground" />
                <p className="text-sm font-semibold">Suggested actions</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Clear next steps for engineers, SREs, and product owners.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Common issues (FAQ) */}
      <div className="px-4 lg:px-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Common issues</h2>
          <p className="text-sm text-muted-foreground">
            Quick answers to the most frequent setup questions.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <Card key={faq.question}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Security & HMAC */}
      <div className="px-4 lg:px-6 space-y-4" id="security-hmac">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Security &amp; HMAC</h2>
          <p className="text-sm text-muted-foreground">
            Authenticate ingestion and ensure payload integrity using HMAC
            signatures.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <IconShield className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Protect every event</p>
                <p className="text-sm text-muted-foreground">
                  Add an HMAC signature to each payload so SeqPulse can verify
                  the sender and prevent spoofed metrics.
                </p>
              </div>
            </div>
            <Button variant="outline" className="md:shrink-0" asChild>
              <a href="#">
                <IconKey className="size-4" />
                Read HMAC guide
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Links */}
      <div className="px-4 lg:px-6 space-y-4" id="links">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Links</h2>
          <p className="text-sm text-muted-foreground">
            Useful shortcuts for deeper exploration (links are static for now).
          </p>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <Card key={link.title} className="group">
              <CardContent className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <link.icon className="size-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <a href="#" className="text-sm font-semibold">
                    {link.title}
                  </a>
                  <p className="text-sm text-muted-foreground">
                    {link.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
