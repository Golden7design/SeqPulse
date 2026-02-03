"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/components/providers/i18n-provider"

import { IconBrandGoogleFilled, IconBrandGithubFilled } from "@tabler/icons-react"

export function SignupForm({
  className,
  onSwitch,
  ...props
}: React.ComponentProps<"form"> & { onSwitch?: () => void }) {
  const { t } = useTranslation()

  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("auth.signup.title")}</h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t("auth.signup.subtitle")}
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="name">{t("auth.fields.fullName")}</FieldLabel>
          <Input id="name" type="text" placeholder={t("auth.placeholders.fullName")} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">{t("auth.fields.email")}</FieldLabel>
          <Input id="email" type="email" placeholder={t("auth.placeholders.email")} required />
          <FieldDescription>
            {t("auth.signup.emailHint")}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("auth.fields.password")}</FieldLabel>
          <Input id="password" type="password" required />
          <FieldDescription>
            {t("auth.signup.passwordHint")}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">{t("auth.fields.confirmPassword")}</FieldLabel>
          <Input id="confirm-password" type="password" required />
          <FieldDescription>{t("auth.signup.confirmPasswordHint")}</FieldDescription>
        </Field>
        <Field>
          <Button variant="outline" type="button">
           <IconBrandGithubFilled className="!size5" />
            {t("auth.signup.oauth.github")}
          </Button>

          <Button variant="outline" type="button" >
            <IconBrandGoogleFilled className="!size-5" />

            {t("auth.signup.oauth.google")}
          </Button>

        </Field>
      </FieldGroup>
    </form>
  )
}
