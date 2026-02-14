"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/components/providers/i18n-provider"
import { useSettingsStore } from "@/store/use-settings-store"
import { fetchCurrentUser, loginUser, signupUser, type SignupPayload, saveAuthToken } from "@/lib/auth-client"

import { IconBrandGoogleFilled, IconBrandGithubFilled } from "@tabler/icons-react"

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
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (formData.password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)
    try {
      await signupUser(formData)
      const auth = await loginUser({
        email: formData.email,
        password: formData.password,
      })
      saveAuthToken(auth.access_token)

      const me = await fetchCurrentUser(auth.access_token)
      setUsername(me.name)
      setEmail(me.email)
      router.replace("/dashboard")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create account."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("auth.signup.title")}</h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t("auth.signup.subtitle")}
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="name">{t("auth.fields.fullName")}</FieldLabel>
          <Input
            id="name"
            type="text"
            placeholder={t("auth.placeholders.fullName")}
            value={formData.name}
            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
            autoComplete="name"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">{t("auth.fields.email")}</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder={t("auth.placeholders.email")}
            value={formData.email}
            onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
            autoComplete="email"
            required
          />
          <FieldDescription>
            {t("auth.signup.emailHint")}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("auth.fields.password")}</FieldLabel>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
            autoComplete="new-password"
            required
          />
          <FieldDescription>
            {t("auth.signup.passwordHint")}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">{t("auth.fields.confirmPassword")}</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
          <FieldDescription>{t("auth.signup.confirmPasswordHint")}</FieldDescription>
        </Field>
        <Field>
          <Button variant="outline" type="button" disabled title="Coming soon">
           <IconBrandGithubFilled className="!size5" />
            {t("auth.signup.oauth.github")}
          </Button>

          <Button variant="outline" type="button" disabled title="Coming soon">
            <IconBrandGoogleFilled className="!size-5" />

            {t("auth.signup.oauth.google")}
          </Button>

        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Loading..." : t("auth.switch.createAccount")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
