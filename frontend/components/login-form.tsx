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

export function LoginForm({
  className,
  onSwitch,
  ...props
}: React.ComponentProps<"form"> & { onSwitch?: () => void }) {
  const { t } = useTranslation()

  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("auth.login.title")}</h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t("auth.login.subtitle")}
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">{t("auth.fields.email")}</FieldLabel>
          <Input id="email" type="email" placeholder={t("auth.placeholders.email")} required />
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
          <Input id="password" type="password" required />
        </Field>
        <Field>
          <Button type="submit">{t("auth.login.submit")}</Button>
        </Field>
        <FieldSeparator className="font-inter">{t("auth.login.oauth.separator")}</FieldSeparator>
        <Field>
          <Button variant="outline" type="button">
           <IconBrandGithubFilled className="!size5" />
            {t("auth.login.oauth.github")}
          </Button>

          <Button variant="outline" type="button" >
            <IconBrandGoogleFilled className="!size-5" />

            {t("auth.login.oauth.google")}
          </Button>

        </Field>
      </FieldGroup>
    </form>
  )
}
