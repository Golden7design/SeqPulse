import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { I18nProvider } from "@/components/providers/i18n-provider"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
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
    { path: "../../public/font/satoshi/Satoshi-Variable.ttf", weight: "400" },
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
      <SidebarProvider
        className={`${inter.className} ${inter.variable} ${satoshi.variable}`}
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        {/* Global rule for elements that should use Satoshi (bold) */}
        <style>{`
          h1,h2,h3,h4,h5,h6,
          [data-slot="sidebar-menu-button"] a,
          [data-slot="sidebar-menu-button"] span,
          [data-side-head="title"] {
            font-family: var(--font-satoshi) !important;
            font-weight: 600 !important;
          }
        `}</style>

        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </I18nProvider>
  )
}