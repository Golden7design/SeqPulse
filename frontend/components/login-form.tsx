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

import { IconBrandGoogleFilled, IconBrandGithubFilled } from "@tabler/icons-react"

export function LoginForm({
  className,
  onSwitch,
  ...props
}: React.ComponentProps<"form"> & { onSwitch?: () => void }) {
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to SeqPulse
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to login to your account
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" placeholder="m@example.com" required />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </a>
          </div>
          <Input id="password" type="password" required />
        </Field>
        <Field>
          <Button type="submit">Login</Button>
        </Field>
        <FieldSeparator className="font-inter">Or continue with</FieldSeparator>
        <Field>
          <Button variant="outline" type="button">
           <IconBrandGithubFilled className="!size5" />
            Login with GitHub
          </Button>

          <Button variant="outline" type="button" >
            <IconBrandGoogleFilled className="!size-5" />

            Login with Google
          </Button>

        </Field>
      </FieldGroup>
    </form>
  )
}
