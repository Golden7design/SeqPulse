"use client"

import * as React from "react"
import {
  IconBlocks,
  IconFolder,
  IconRocket,
  IconHelp,
  IconSettings,
  IconInfoCircle
} from "@tabler/icons-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { SeqPulseLogoMark } from "@/components/seqpulse-logo-mark"
import { useSettingsStore } from "@/store/use-settings-store"
import en from "@/locales/en.json"
import fr from "@/locales/fr.json"
import es from "@/locales/es.json"
import de from "@/locales/de.json"

const LOCALES = { en, fr, es, de }

type NavKey = "dashboard" | "projects" | "deployments" | "sdh" | "help" | "settings"

const data = {
  navMain: [
    { key: "dashboard", title: "Dashboard", url: "/dashboard", icon: IconBlocks },
    { key: "projects", title: "Projects", url: "/dashboard/projects", icon: IconFolder },
    { key: "deployments", title: "Deployments", url: "/dashboard/deployments", icon: IconRocket },
    { key: "sdh", title: "SDH", url: "/dashboard/SDH", icon: IconInfoCircle },
    { key: "settings", title: "Settings", url: "/dashboard/settings", icon: IconSettings },
    { key: "help", title: "Help", url: "/dashboard/Help", icon: IconHelp },
  ] as Array<{ key: NavKey; title: string; url: string; icon: React.ComponentType<{ className?: string }> }>,
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const language = useSettingsStore((s) => s.language)
  const username = useSettingsStore((s) => s.username)
  const email = useSettingsStore((s) => s.email)
  const locale = LOCALES[language] ?? LOCALES.en
  const closeSidebarOnMobile = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [isMobile, setOpenMobile])
  const pathSegments = pathname.split("/").filter(Boolean)
  const isProjectDetailRoute =
    pathSegments[0] === "dashboard" &&
    pathSegments[1] === "projects" &&
    Boolean(pathSegments[2]) &&
    pathSegments[2] !== "new"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
              <Link href="/dashboard" className="h-14 flex items-center gap-1.5" onClick={closeSidebarOnMobile} >
                <SeqPulseLogoMark className="size-11! text-black dark:text-white" />


                <span className="app-brand-title text-[20px] text-black dark:text-white font-semibold">
                  {locale?.app?.title ?? 'Seqpulse'}
                </span>
              </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="flex flex-col gap-2 p-2">
          <SidebarMenu>
            {data.navMain.map((item) => {
              const isActive = pathname === item.url
              const label = locale?.nav?.[item.key] ?? item.title
              return (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={label} className="mb-2 h-auto py-2.5">
                    <Link href={item.url} onClick={closeSidebarOnMobile}>
                      {item.icon && <item.icon className="size-6!" />}
                      <span className="text-[16px] font-bold">{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
          {isProjectDetailRoute ? (
            <div className="mt-18 p-2">
              <div className="rounded-lg bg-linear-to-b from-black/10 to-transparent p-4 pt-7 pb-7 space-y-3 dark:from-white/10">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">
                    {locale?.sidebar?.upgrade?.title ?? 'Upgrade to Pro'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {locale?.sidebar?.upgrade?.subtitle ?? 'For more ressources and features'}
                  </p>
                </div>
                <Button
                  asChild
                  size="sm"
                  className="w-full"
                >
                  <Link href="/dashboard/settings" onClick={closeSidebarOnMobile}>
                    {locale?.sidebar?.upgrade?.button ?? 'Upgrade'}
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: username,
            email,
            avatar: "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
