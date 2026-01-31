"use client"

import * as React from "react"
import {
  IconBlocks,
  IconFolder,
  IconInnerShadowTop,
  IconRocket,
  IconHelp,
  IconSettings,
  IconActivityHeartbeat,
} from "@tabler/icons-react"
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
} from "@/components/ui/sidebar"
import { useSettingsStore } from "@/store/use-settings-store"
import en from "@/locales/en.json"
import fr from "@/locales/fr.json"
import es from "@/locales/es.json"
import de from "@/locales/de.json"

const LOCALES: Record<string, any> = { en, fr, es, de }

const data = {
  user: {
    name: "Nassir",
    email: "gouombanassir@gmail.com",
    avatar: "",
  },
  navMain: [
    { key: "dashboard", title: "Dashboard", url: "/dashboard", icon: IconBlocks },
    { key: "projects", title: "Projects", url: "/dashboard/projects", icon: IconFolder },
    { key: "deployments", title: "Deployments", url: "/dashboard/deployments", icon: IconRocket },
    { key: "sdh", title: "SDH", url: "/dashboard/SDH", icon: IconActivityHeartbeat },
    { key: "help", title: "Help", url: "/dashboard/Help", icon: IconHelp },
    { key: "settings", title: "Settings", url: "/dashboard/settings", icon: IconSettings },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const language = useSettingsStore((s) => s.language)
  const locale = LOCALES[language] ?? LOCALES.en

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/dashboard">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">SeqPulse</span>
              </a>
            </SidebarMenuButton>
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
                  <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                    <a href={item.url}>
                      {item.icon && <item.icon />}
                      <span>{label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}