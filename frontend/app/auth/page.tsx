"use client"
import { GalleryVerticalEnd } from "lucide-react"
import { useState } from "react"

import { LoginForm } from "@/components/login-form"
import { SignupForm } from "@/components/signup-form"
import { useTranslation } from "@/components/providers/i18n-provider"

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const { t } = useTranslation()

  return (
    <>
      <div className="flex justify-center gap-2 md:justify-start">
        <a href="#" className="flex font-satoshi text-2xl font-bold items-center gap-2">
          <div className=" text-black dark:text-white flex items-center justify-center rounded-md">
            <svg className="!size-11" viewBox="0 0 188 244" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M43.3848 84.8528C33.2311 74.6992 33.2311 58.2369 43.3848 48.0833L91.468 -3.45707e-06L123.288 31.8198L56.8198 98.2878L43.3848 84.8528Z" fill="currentColor"/>
<path d="M60.0833 211.551L126.551 145.083L139.986 158.518C150.14 168.672 150.14 185.134 139.986 195.288L91.9031 243.371L60.0833 211.551Z" fill="currentColor"/>
<path d="M83.8145 142.152L84.5439 144H25C13.4414 144 3.71689 136.155 0.855469 125.5H65.6826L66.959 123.14L72.3623 113.142L83.8145 142.152ZM115.447 124.307L116.74 125.5H188V144H91.1924L91.9189 142.711L101.628 125.5H108.479L109.817 124.041L112.266 121.369L115.447 124.307ZM163 99C174.194 99 183.669 106.357 186.854 116.5H120.26L115.053 111.693L111.734 108.631L108.683 111.959L104.521 116.5H96.3721L95.0811 118.789L88.7188 130.066L77.1855 100.848L76.4561 99H163ZM69.041 100.36L60.3164 116.5H0V99H69.7764L69.041 100.36Z" fill="currentColor"/>
</svg>

          </div>
          {t("app.title")}
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
              {t("auth.switch.newHere")}{' '}
              <button className="underline" onClick={() => setMode('signup')}>
                {t("auth.switch.createAccount")}
              </button>
            </>
          ) : (
            <>
              {t("auth.switch.alreadyRegistered")}{' '}
              <button className="underline" onClick={() => setMode('login')}>
                {t("auth.switch.signIn")}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
