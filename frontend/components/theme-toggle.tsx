"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

export function ModeToggle() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const buttonRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = async (newTheme: string) => {
    if (newTheme === theme) return

    type ViewTransition = {
      ready: Promise<void>
    }
    type BrowserDocument = {
      createElement: (tagName: string) => HTMLElement
      body: HTMLElement | null
      documentElement: HTMLElement
      defaultView: Window | null
      startViewTransition?: (callback: () => void) => ViewTransition
    }

    const doc =
      typeof document !== "undefined"
        ? (document as BrowserDocument)
        : undefined
    const win = doc?.defaultView
    if (!doc || !win) {
      setTheme(newTheme)
      return
    }

    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) {
      setTheme(newTheme)
      return
    }

    // Position de départ de l'animation (coin supérieur droit du toggle)
    const x = rect.right
    const y = rect.top

    // Calculer le rayon nécessaire pour couvrir tout l'écran depuis ce point
    const endRadius = Math.hypot(
      Math.max(x, win.innerWidth - x),
      Math.max(y, win.innerHeight - y)
    )

    // Vérifier si le navigateur supporte View Transitions API
    if ('startViewTransition' in doc) {
      // @ts-ignore - View Transitions API
      const transition = doc.startViewTransition(() => {
        setTheme(newTheme)
      })

      // Appliquer l'animation d'onde personnalisée
      transition.ready.then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`
        ]

        doc.documentElement.animate(
          {
            clipPath
          },
          {
            duration: 700,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        )
      })
    } else {
      // Fallback avec animation manuelle pour les navigateurs plus anciens
      const isDark = newTheme === 'dark' || (newTheme === 'system' && systemTheme === 'dark')
      
      // Créer un overlay pour l'animation
      const overlay = doc.createElement('div')
      overlay.style.position = 'fixed'
      overlay.style.top = '0'
      overlay.style.left = '0'
      overlay.style.width = '100%'
      overlay.style.height = '100%'
      overlay.style.pointerEvents = 'none'
      overlay.style.zIndex = '9999'
      overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`
      overlay.style.backgroundColor = isDark ? '#000' : '#fff'
      overlay.style.transition = 'clip-path 0.7s cubic-bezier(0.4, 0, 0.2, 1)'
      
      doc.body?.appendChild(overlay)
      
      // Déclencher l'animation
      win.requestAnimationFrame(() => {
        overlay.style.clipPath = `circle(${endRadius}px at ${x}px ${y}px)`
      })
      
      // Changer le thème à mi-parcours
      setTimeout(() => {
        setTheme(newTheme)
      }, 350)
      
      // Nettoyer après l'animation
      setTimeout(() => {
        overlay.remove()
      }, 700)
    }
  }

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 rounded-md border bg-background p-1">
        <div className="size-8 rounded bg-muted animate-pulse" />
        <div className="size-8 rounded bg-muted animate-pulse" />
        <div className="size-8 rounded bg-muted animate-pulse" />
      </div>
    )
  }

  const themes = [
    { name: "light", icon: Sun, label: "Light" },
    { name: "dark", icon: Moon, label: "Dark" },
    { name: "system", icon: Monitor, label: "System" },
  ]

  return (
    <div 
      ref={buttonRef}
      className="flex items-center gap-1 rounded-md border bg-background p-1"
    >
      {themes.map(({ name, icon: Icon, label }) => (
        <button
          key={name}
          onClick={() => handleThemeChange(name)}
          className={cn(
            "relative flex items-center justify-center size-8 rounded transition-all duration-200",
            "hover:bg-accent hover:text-accent-foreground",
            theme === name && "bg-accent text-accent-foreground"
          )}
          aria-label={label}
          title={label}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}
