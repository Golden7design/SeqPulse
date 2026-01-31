"use client"
import { GalleryVerticalEnd } from "lucide-react"
import { useState } from "react"

import { LoginForm } from "@/components/login-form"
import { SignupForm } from "@/components/signup-form"

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  return (
    <>
      <div className="flex justify-center gap-2 md:justify-start">
        <a href="#" className="flex items-center gap-2 font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          Acme Inc.
        </a>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md">
          {mode === 'login' ? (
            <LoginForm onSwitch={() => setMode('signup')} />
          ) : (
            <SignupForm onSwitch={() => setMode('login')} />
          )}
        </div>
      </div>

      <div className="flex justify-center md:justify-start">
        <div className="text-sm text-muted-foreground">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button className="underline" onClick={() => setMode('signup')}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already registered?{' '}
              <button className="underline" onClick={() => setMode('login')}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
