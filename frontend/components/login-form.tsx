"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/components/providers/i18n-provider"
import { useSettingsStore } from "@/store/use-settings-store"
import { fetchCurrentUser, loginUser, saveAuthToken } from "@/lib/auth-client"

import { IconBrandGoogleFilled, IconBrandGithubFilled } from "@tabler/icons-react"

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
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("auth.login.title")}</h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t("auth.login.subtitle")}
          </p>
        </div>
        <Field>
          <Button variant="outline" type="button" disabled title="Coming soon">
           <IconBrandGithubFilled className="!size5" />
            {t("auth.login.oauth.github")}
          </Button>

          <Button variant="outline" type="button" disabled title="Coming soon">
            <IconBrandGoogleFilled className="!size-5" />

            {t("auth.login.oauth.google")}
          </Button>

        </Field>

        <FieldSeparator className="font-inter">{t("auth.login.oauth.separator")}</FieldSeparator>
        <Field>
          <FieldLabel htmlFor="email">{t("auth.fields.email")}</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder={t("auth.placeholders.email")}
            value={email}
            onChange={(event) => setEmailInput(event.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">{t("auth.fields.password")}</FieldLabel>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              {t("auth.login.forgotPassword")}
            </a>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Loading..." : t("auth.login.submit")}
          </Button>
        </Field>
        
      </FieldGroup>
    </form>
  )
}
