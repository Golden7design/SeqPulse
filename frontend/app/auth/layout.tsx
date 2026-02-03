import React from "react"
import localFont from "next/font/local"

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
    { path: "../../public/font/satoshi/Satoshi-Bold.otf", weight: "700" },
    { path: "../../public/font/satoshi/Satoshi-Medium.otf", weight: "500" },
  ],
  display: "swap",
  variable: "--font-satoshi",
})



export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${satoshi.variable} grid min-h-svh lg:grid-cols-2`} suppressHydrationWarning >
              {/* Global rule for elements that should use Satoshi (bold) */}
        <style>{`
          /* Titres - Satoshi Bold */
          h1, h2, h3, h4, h5, h6, a {
            font-family: var(--font-satoshi) !important;
            font-weight: 600 !important;
          }

          /* Sidebar menu buttons - Satoshi Bold */
          [data-slot="sidebar-menu-button"],
          [data-slot="sidebar-menu-button"] a,
          [data-slot="sidebar-menu-button"] span,
          [data-slot="sidebar-menu-button"] button {
            font-family: var(--font-satoshi) !important;
            font-weight: 600 !important;
          }

          /* Header title - Satoshi Bold */
          header h1,
          [data-slot="site-header"] h1 {
            font-family: var(--font-satoshi) !important;
            font-weight: 600 !important;
          }

          /* Card titles - Satoshi Bold */
          [data-slot="card-title"] {
            font-family: var(--font-satoshi) !important;
            font-weight: 600 !important;
          }

          /* Buttons use pointer cursor */
          button,
          [data-slot="button"] {
            cursor: pointer;
          }

          /* Ensure all text is bold in sidebar menu buttons */
          .group\\/sidebar-wrapper [data-slot="sidebar-menu-button"] * {
            font-family: var(--font-satoshi) !important;
            font-weight: 600 !important;
          }
        `}</style>
      <div className="flex flex-col gap-4 p-6 md:p-10" suppressHydrationWarning>
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
