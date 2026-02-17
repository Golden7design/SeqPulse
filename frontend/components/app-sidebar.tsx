"use client"

import * as React from "react"
import {
  IconBlocks,
  IconFolder,
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
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/store/use-settings-store"
import en from "@/locales/en.json"
import fr from "@/locales/fr.json"
import es from "@/locales/es.json"
import de from "@/locales/de.json"

const LOCALES = { en, fr, es, de }

const data = {
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
  const username = useSettingsStore((s) => s.username)
  const email = useSettingsStore((s) => s.email)
  const locale = LOCALES[language] ?? LOCALES.en
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
              <a href="/dashboard" className="h-14 flex items-center gap-1.5" >
                <svg className="!size-11 text-black dark:text-white" viewBox="0 0 188 244" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M43.3848 84.8528C33.2311 74.6992 33.2311 58.2369 43.3848 48.0833L91.468 -3.45707e-06L123.288 31.8198L56.8198 98.2878L43.3848 84.8528Z" fill="currentColor"/>
<path d="M60.0833 211.551L126.551 145.083L139.986 158.518C150.14 168.672 150.14 185.134 139.986 195.288L91.9031 243.371L60.0833 211.551Z" fill="currentColor"/>
<path d="M83.8145 142.152L84.5439 144H25C13.4414 144 3.71689 136.155 0.855469 125.5H65.6826L66.959 123.14L72.3623 113.142L83.8145 142.152ZM115.447 124.307L116.74 125.5H188V144H91.1924L91.9189 142.711L101.628 125.5H108.479L109.817 124.041L112.266 121.369L115.447 124.307ZM163 99C174.194 99 183.669 106.357 186.854 116.5H120.26L115.053 111.693L111.734 108.631L108.683 111.959L104.521 116.5H96.3721L95.0811 118.789L88.7188 130.066L77.1855 100.848L76.4561 99H163ZM69.041 100.36L60.3164 116.5H0V99H69.7764L69.041 100.36Z" fill="currentColor"/>
</svg>


                <span className="text-[17px] text-black dark:text-white font-satoshi font-semibold">{locale?.app?.title ?? 'SeqPulse'}</span>
              </a>
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
                    <a href={item.url} className="mb-2" >
                      {item.icon && <item.icon className="!size-6" />}
                      <span className="text-[16px] font-bold">{label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
          {isProjectDetailRoute ? (
            <div className="mt-18 p-2">
              <div className="rounded-lg bg-gradient-to-b from-black/10 to-transparent p-4 pt-7 pb-7 space-y-3 dark:from-white/10">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">
                    {locale?.sidebar?.upgrade?.title ?? 'Upgrade to Pro'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {locale?.sidebar?.upgrade?.subtitle ?? 'Get 1 month free and unlock'}
                  </p>
                </div>
                <Button
                  asChild
                  size="sm"
                  className="w-full"
                >
                  <a href="/dashboard/settings">
                    {locale?.sidebar?.upgrade?.button ?? 'Upgrade'}
                  </a>
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
