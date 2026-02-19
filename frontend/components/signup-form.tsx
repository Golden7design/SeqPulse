"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/i18n-provider"
import { useSettingsStore } from "@/store/use-settings-store"
import {
  fetchCurrentUserFromSession,
  loginUser,
  signupUser,
  type SignupPayload,
  startOAuth,
} from "@/lib/auth-client"

import {
  IconBrandGoogleFilled,
  IconBrandGithubFilled,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { t } = useTranslation()
  const router = useRouter()
  const setUsername = useSettingsStore((state) => state.setUsername)
  const setEmail = useSettingsStore((state) => state.setEmail)
  const [formData, setFormData] = useState<SignupPayload>({
    name: "",
    email: "",
    password: "",
  })
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputClasses =
    "w-full rounded-xl border border-border/70 bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
  const buttonBaseClasses =
    "inline-flex w-full items-center justify-center rounded-xl px-3.5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (formData.password !== confirmPassword) {
      setError(t("auth.errors.passwordsDoNotMatch"))
      return
    }

    setIsSubmitting(true)
    try {
      await signupUser(formData)
      await loginUser({
        email: formData.email,
        password: formData.password,
      })
      const me = await fetchCurrentUserFromSession()
      setUsername(me.name)
      setEmail(me.email)
      router.replace("/dashboard")
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.errors.signupFailed")
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGithubSignup = () => {
    setError(null)
    startOAuth("github", "signup")
  }

  const handleGoogleSignup = () => {
    setError(null)
    startOAuth("google", "signup")
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm md:p-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("auth.signup.title")}</h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t("auth.signup.subtitle")}
          </p>
        </div>
        <div className="mt-6 space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium">
            {t("auth.fields.fullName")}
          </label>
          <input
            id="name"
            type="text"
            className={inputClasses}
            placeholder={t("auth.placeholders.fullName")}
            value={formData.name}
            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
            autoComplete="name"
            required
          />
        </div>
        <div className="mt-4 space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium">
            {t("auth.fields.email")}
          </label>
          <input
            id="email"
            type="email"
            className={inputClasses}
            placeholder={t("auth.placeholders.email")}
            value={formData.email}
            onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
            autoComplete="email"
            required
          />
          <p className="text-xs text-muted-foreground">
            {t("auth.signup.emailHint")}
          </p>
        </div>
        <div className="mt-4 space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium">
            {t("auth.fields.password")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className={cn(inputClasses, "pr-11")}
              value={formData.password}
              onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={showPassword ? t("auth.common.hidePassword") : t("auth.common.showPassword")}
            >
              {showPassword ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("auth.signup.passwordHint")}
          </p>
        </div>
        <div className="mt-4 space-y-1.5">
          <label htmlFor="confirm-password" className="block text-sm font-medium">
            {t("auth.fields.confirmPassword")}
          </label>
          <div className="relative">
            <input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              className={cn(inputClasses, "pr-11")}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={showConfirmPassword ? t("auth.common.hidePassword") : t("auth.common.showPassword")}
            >
              {showConfirmPassword ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{t("auth.signup.confirmPasswordHint")}</p>
        </div>
        <div className="mt-5 space-y-2.5">
          <button
            className={cn(buttonBaseClasses, "border border-border bg-background text-foreground")}
            type="button"
            onClick={handleGithubSignup}
            disabled={isSubmitting}
          >
            <IconBrandGithubFilled className="size-5" />
            {t("auth.signup.oauth.github")}
          </button>

          <button
            className={cn(buttonBaseClasses, "border border-border bg-background text-foreground")}
            type="button"
            onClick={handleGoogleSignup}
            disabled={isSubmitting}
          >
            <IconBrandGoogleFilled className="size-5" />

            {t("auth.signup.oauth.google")}
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        <div className="mt-5">
          <button
            className={cn(buttonBaseClasses, "bg-foreground text-background hover:opacity-90")}
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("common.loading") : t("auth.switch.createAccount")}
          </button>
        </div>
      </div>
    </form>
  )
}
