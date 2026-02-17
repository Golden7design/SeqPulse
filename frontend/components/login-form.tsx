"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/i18n-provider"
import { useSettingsStore } from "@/store/use-settings-store"
import { fetchCurrentUser, loginUser, saveAuthToken } from "@/lib/auth-client"

import {
  IconBrandGoogleFilled,
  IconBrandGithubFilled,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { t } = useTranslation()
  const router = useRouter()
  const setUsername = useSettingsStore((state) => state.setUsername)
  const setEmail = useSettingsStore((state) => state.setEmail)
  const [email, setEmailInput] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputClasses =
    "w-full rounded-xl border border-border/70 bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
  const buttonBaseClasses =
    "inline-flex w-full items-center justify-center rounded-xl px-3.5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const auth = await loginUser({ email, password })
      saveAuthToken(auth.access_token)

      const me = await fetchCurrentUser(auth.access_token)
      setUsername(me.name)
      setEmail(me.email)
      router.replace("/dashboard")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to login."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm md:p-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("auth.login.title")}</h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t("auth.login.subtitle")}
          </p>
        </div>
        <div className="mt-6 space-y-2.5">
          <button
            className={cn(buttonBaseClasses, "border border-border bg-background text-foreground")}
            type="button"
            disabled
            title="Coming soon"
          >
            <IconBrandGithubFilled className="size-5" />
            {t("auth.login.oauth.github")}
          </button>

          <button
            className={cn(buttonBaseClasses, "border border-border bg-background text-foreground")}
            type="button"
            disabled
            title="Coming soon"
          >
            <IconBrandGoogleFilled className="size-5" />

            {t("auth.login.oauth.google")}
          </button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>{t("auth.login.oauth.separator")}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-4">
          <label htmlFor="email" className="block text-sm font-medium">
            {t("auth.fields.email")}
          </label>
          <input
            id="email"
            type="email"
            className={inputClasses}
            placeholder={t("auth.placeholders.email")}
            value={email}
            onChange={(event) => setEmailInput(event.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="mt-4 space-y-4">
          <div className="flex items-center">
            <label htmlFor="password" className="text-sm font-medium">
              {t("auth.fields.password")}
            </label>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              {t("auth.login.forgotPassword")}
            </a>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className={cn(inputClasses, "pr-11")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
            </button>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        <div className="mt-5">
          <button
            className={cn(buttonBaseClasses, "bg-foreground text-background hover:opacity-90")}
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Loading..." : t("auth.login.submit")}
          </button>
        </div>
      </div>
    </form>
  )
}
