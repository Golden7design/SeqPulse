import { AppSidebar } from "@/components/app-sidebar"
import { AuthGate } from "@/components/auth-gate"
import { SiteHeader } from "@/components/site-header"
import { I18nProvider } from "@/components/providers/i18n-provider"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import localFont from "next/font/local"

const googleSansFlex = localFont({
  src: "../../public/font/google-sans-flex/GoogleSansFlex-VariableFont_GRAD,ROND,opsz,slnt,wdth,wght.ttf",
  display: "swap",
  variable: "--font-google-sans-flex",
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <I18nProvider>
      <AuthGate>
        <SidebarProvider
          className={`${googleSansFlex.className} ${googleSansFlex.variable} ${satoshi.variable}`}
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties
          }
        >
          {/* Global rule for elements that should use Satoshi (bold) */}
          <style>{`
          /* Titres - Satoshi Bold */
          h1, h2, h3, h4, h5, h6 {
            font-family: ${satoshi.style.fontFamily} !important;
            font-weight: 600 !important;
          }

          /* Sidebar text on all breakpoints (desktop + mobile sheet portal) */
          [data-slot="sidebar"],
          [data-slot="sidebar"] * {
            font-family: ${satoshi.style.fontFamily} !important;
          }

          .app-brand-title {
            font-family: ${satoshi.style.fontFamily} !important;
            font-weight: 600 !important;
          }

          /* Sidebar menu buttons - Satoshi Bold */
          [data-slot="sidebar-menu-button"],
          [data-slot="sidebar-menu-button"] a,
          [data-slot="sidebar-menu-button"] span,
          [data-slot="sidebar-menu-button"] button {
            font-family: ${satoshi.style.fontFamily} !important;
            font-weight: 600 !important;
          }

          /* Header title - Satoshi Bold */
          header h1,
          [data-slot="site-header"] h1 {
            font-family: ${satoshi.style.fontFamily} !important;
            font-weight: 600 !important;
          }

          /* Card titles - Satoshi Bold */
          [data-slot="card-title"] {
            font-family: ${satoshi.style.fontFamily} !important;
            font-weight: 600 !important;
          }

          /* Buttons use pointer cursor */
          button,
          [data-slot="button"] {
            cursor: pointer;
          }

          /* Ensure all text is bold in sidebar menu buttons */
          .group\\/sidebar-wrapper [data-slot="sidebar-menu-button"] * {
            font-family: ${satoshi.style.fontFamily} !important;
            font-weight: 600 !important;
          }
        `}</style>

          <AppSidebar variant="inset" />
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
                {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </AuthGate>
    </I18nProvider>
  )
}
