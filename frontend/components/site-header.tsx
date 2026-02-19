"use client"

import { usePathname } from "next/navigation"
import { IconSearch } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ModeToggle } from "./theme-toggle"
import { useTranslation } from "@/components/providers/i18n-provider"

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
          <div className="relative hidden md:block">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("common.search")}
              className="w-64 pl-8"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
          >
            <IconSearch className="size-4" />
            <span className="sr-only">{t("common.search")}</span>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
