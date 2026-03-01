"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ModeToggle } from "./theme-toggle"
import { useTranslation } from "@/components/providers/i18n-provider"
import { HeaderSearch } from "@/components/header-search"

function getPageTitle(pathname: string, t: (key: string) => string): string {
  const pathSegments = pathname.split('/').filter(Boolean)

  if (pathSegments.length === 1 && pathSegments[0] === 'dashboard') {
    return t("nav.dashboard")
  }

  if (pathSegments.length === 2 && pathSegments[0] === 'dashboard') {
    const page = pathSegments[1].toLowerCase()
    const key = `nav.${page}`
    const translated = t(key)
    return translated === key ? (page.charAt(0).toUpperCase() + page.slice(1)) : translated
  }

  return t("nav.dashboard")
}

export function SiteHeader() {
  const pathname = usePathname()
  const { t } = useTranslation()
  const pageTitle = getPageTitle(pathname, t)
  const shortcutHint = "Ctrl/Cmd K"

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-semibold">{pageTitle}</h1>
        <div className="ml-auto flex items-center gap-2">
          <HeaderSearch placeholder={t("common.search")} shortcutHint={shortcutHint} />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
