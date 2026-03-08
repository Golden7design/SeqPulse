"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/i18n-provider"
import { useSettingsStore } from "@/store/use-settings-store"
import { fetchCurrentUserFromSession, loginUser, startOAuth } from "@/lib/auth-client"

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
    "h-12 w-full rounded-md border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-300 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-700"
  const buttonBaseClasses =
    "inline-flex w-full cursor-pointer items-center justify-center rounded-md px-3.5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const loginResult = await loginUser({ email, password })
      if (loginResult.requires_2fa) {
        if (!loginResult.challenge_id) {
          throw new Error(t("auth.errors.twofaChallengeMissingRetry"))
        }
        const params = new URLSearchParams({ challenge_id: loginResult.challenge_id })
        if (loginResult.challenge_expires_at) {
          params.set("expires_at", loginResult.challenge_expires_at)
        }
        router.replace(`/auth/2fa-challenge?${params.toString()}`)
        return
      }
      const me = await fetchCurrentUserFromSession()
      setUsername(me.name)
      setEmail(me.email)
      router.replace("/dashboard")
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.errors.loginFailed")
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGithubLogin = () => {
    setError(null)
    startOAuth("github", "login")
  }

  const handleGoogleLogin = () => {
    setError(null)
    startOAuth("google", "login")
  }

  return (
    <form className={cn("space-y-6", className)} onSubmit={handleSubmit} {...props}>
      <div className="space-y-5">
        <h1 className="auth-heading text-[38px] leading-none text-zinc-900 dark:text-zinc-100">{t("auth.login.title")}</h1>

        <div className="space-y-2">
          <label htmlFor="email" className="auth-p block text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
            {t("auth.fields.email")}
          </label>
          <input
            id="email"
            type="email"
            className={inputClasses}
            placeholder="example@gmail.com"
            value={email}
            onChange={(event) => setEmailInput(event.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="auth-p block text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
            {t("auth.fields.password")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className={cn(inputClasses, "pr-11")}
              placeholder="StrongP@ssw0rd"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="auth-p absolute inset-y-0 right-2 my-auto inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label={showPassword ? t("auth.common.hidePassword") : t("auth.common.showPassword")}
            >
              {showPassword ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <button
          className={cn(buttonBaseClasses, "auth-heading bg-zinc-900 text-white hover:bg-black dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white")}
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? t("common.loading") : t("auth.login.submit")}
        </button>

        <div className="auth-p flex justify-end">
          <a href="#" className="cursor-pointer text-xs font-semibold text-zinc-600 underline underline-offset-2 dark:text-zinc-400">
            {t("auth.login.forgotPassword")}
          </a>
        </div>

        <div className="pt-2">
          <p className="auth-p mb-3 text-center text-sm text-zinc-600 dark:text-zinc-400">{t("auth.login.oauth.separator")}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              className={cn(buttonBaseClasses, "auth-p gap-1.5 h-11 border border-zinc-300 bg-transparent text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800")}
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
            >
              <IconBrandGoogleFilled className="size-5" />
              <span>Google</span>
            </button>
            <button
              className={cn(buttonBaseClasses, "auth-p gap-1.5 h-11 border border-zinc-300 bg-transparent text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800")}
              type="button"
              onClick={handleGithubLogin}
              disabled={isSubmitting}
            >
              <IconBrandGithubFilled className="size-5" />
              <span>GitHub</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
