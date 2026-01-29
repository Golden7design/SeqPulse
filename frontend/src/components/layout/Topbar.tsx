"use client";

import { usePathname } from "next/navigation";
import { useAppStore } from "@/stores/app.store";
import { ModeToggle } from "../theme-toggle";

export function TopBar() {
  const pathname = usePathname();
  const t = useAppStore((s) => s.t);

  let titleKey = "dashboard";
  if (pathname.startsWith("/projects")) titleKey = "projects";
  if (pathname.startsWith("/deployments")) titleKey = "deployments";
  if (pathname.startsWith("/sdh")) titleKey = "sdh";
  if (pathname.startsWith("/settings")) titleKey = "settings";

  return (
    <div className="h-14 border-b flex items-center px-6">
      <h1 className="text-lg font-semibold">{t(titleKey)}</h1>
      <ModeToggle/>
    </div>
  );
}
