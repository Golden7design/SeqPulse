"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/stores/app.store";

const links = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/dashboard/projects", key: "projects" },
  { href: "/dashboard/deployments", key: "deployments" },
  { href: "/dashboard/SDH", key: "sdh" },
  { href: "/dashboard/settings", key: "settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useAppStore((s) => s.t);

  return (
    <aside className="w-60 bg-muted h-screen p-4">
      <div className="font-bold mb-4">SeqPulse</div>

      <nav className="space-y-2">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-2 py-1 rounded ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t(link.key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
