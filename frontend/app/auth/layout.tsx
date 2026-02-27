import React from "react"
import localFont from "next/font/local"
import Image from "next/image"
import { PageTransition } from "@/components/animations/state-transitions"
import { I18nProvider } from "@/components/providers/i18n-provider"

const inter = localFont({
  src: [
    { path: "../../public/font/Inter-Full-Version/Web Fonts/Inter/Inter-Regular.woff2", weight: "400" },
    { path: "../../public/font/Inter-Full-Version/Web Fonts/Inter/Inter-SemiBold.woff2", weight: "600" },
  ],
  display: "swap",
  variable: "--font-inter",
})

const satoshi = localFont({
  src: [
    { path: "../../public/font/bricolage-grotesque/static/BricolageGrotesque-Bold.ttf", weight: "700" },
    { path: "../../public/font/bricolage-grotesque/static/BricolageGrotesque-Medium.ttf", weight: "500" },
    { path: "../../public/font/bricolage-grotesque/static/BricolageGrotesque-SemiBold.ttf", weight: "600" },
  ],
  display: "swap",
  variable: "--font-satoshi",
})

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div
        className={`${inter.variable} ${satoshi.variable} grid min-h-svh bg-zinc-200 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 lg:grid-cols-[46%_54%]`}
        suppressHydrationWarning
      >
        <style>{`
          .auth-heading,
          .app-brand-title {
            font-family: ${satoshi.style.fontFamily};
            font-weight: 600;
          }
        `}</style>

        <div className="flex min-h-svh items-center justify-center bg-zinc-100 px-6 py-8 dark:bg-zinc-900 md:px-10">
          <div className="w-full max-w-[460px]" suppressHydrationWarning>
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </div>

        <div className="relative hidden overflow-hidden border-l border-black/5 dark:border-white/10 lg:block">
          <Image
            src="/png.png"
            alt="Auth visual"
            fill
            sizes="54vw"
            className="object-cover"
            priority
          />
        </div>
      </div>
    </I18nProvider>
  )
}
