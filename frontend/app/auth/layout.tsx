import React from "react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2" suppressHydrationWarning >
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {children}
      </div>

      <div className="bg-muted relative hidden lg:block">
        <img
          src="/png.png"
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}
