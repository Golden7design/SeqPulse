"use client"

import { usePathname } from "next/navigation"
import { IconSearch } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ModeToggle } from "./theme-toggle"
import { useSettingsStore } from "@/store/use-settings-store"
import en from "@/locales/en.json"
import fr from "@/locales/fr.json"
import es from "@/locales/es.json"
import de from "@/locales/de.json"

type LocaleMessages = typeof en

const LOCALES: Record<string, LocaleMessages> = {
  en,
  fr: fr as LocaleMessages,
  es: es as LocaleMessages,
  de: de as LocaleMessages,
}

// Fonction pour obtenir le titre de la page en fonction du pathname
function getPageTitle(pathname: string, locale: LocaleMessages): string {
  const pathSegments = pathname.split('/').filter(Boolean)

  if (pathSegments.length === 1 && pathSegments[0] === 'dashboard') {
    return locale?.nav?.dashboard ?? 'Dashboard'
  }

  if (pathSegments.length === 2 && pathSegments[0] === 'dashboard') {
    const page = pathSegments[1].toLowerCase()
    return locale?.nav?.[page] ?? (page.charAt(0).toUpperCase() + page.slice(1))
  }

  return locale?.nav?.dashboard ?? 'Dashboard'
}

export function SiteHeader() {
  const pathname = usePathname()
  const language = useSettingsStore((s) => s.language)
  const locale = LOCALES[language] ?? LOCALES.en
  const pageTitle = getPageTitle(pathname, locale)

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
              placeholder="Search..."
              className="w-64 pl-8"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
          >
            <IconSearch className="size-4" />
            <span className="sr-only">Search</span>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
