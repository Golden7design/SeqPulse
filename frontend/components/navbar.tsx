 "use client"

import * as React from "react"
import Link from "next/link"
import gsap from "gsap"

import { SeqPulseLogoMark } from "@/components/seqpulse-logo-mark"
import { cn } from "@/lib/utils"

const palette = {
  logo: "#000000",
  link: "#45474D",
  ctaBackground: "#121317",
  signInBackground: "#FFFFFF",
  border: "#D1D5DB",
}

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#docs" },
]

export function Navbar() {
  const colorVars = React.useMemo(
    () => ({
      "--nav-logo-color": palette.logo,
      "--nav-link-color": palette.link,
      "--nav-cta-bg": palette.ctaBackground,
      "--nav-signin-bg": palette.signInBackground,
      "--nav-border-color": palette.border,
    } as React.CSSProperties),
    []
  )

  const [open, setOpen] = React.useState(false)
  const [hidden, setHidden] = React.useState(false)
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const openRef = React.useRef(false)

  // Lock body scroll when mobile menu is open
  React.useEffect(() => {
    openRef.current = open
    if (open) {
      setHidden(false) // keep nav visible while menu is open
    }
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  // Hide on scroll down, show on scroll up
  React.useEffect(() => {
    let lastY = window.scrollY
    let ticking = false

    const update = () => {
      ticking = false
      const currentY = window.scrollY
      const delta = currentY - lastY

      if (openRef.current) {
        return
      }

      if (delta > 8 && currentY > 32) {
        setHidden(true)
      } else if (delta < -8) {
        setHidden(false)
      }

      lastY = currentY
    }

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update)
        ticking = true
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Animate overlay with GSAP
  React.useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    if (open) {
      gsap.set(overlay, { display: "block" })
      gsap.fromTo(
        overlay,
        { y: "-100%", opacity: 0 },
        { y: "0%", opacity: 1, duration: 0.35, ease: "power3.out" }
      )
    } else {
      gsap.to(overlay, {
        y: "-100%",
        opacity: 0,
        duration: 0.25,
        ease: "power2.in",
        onComplete: () => {
          gsap.set(overlay, { display: "none" })
        },
      })
    }
  }, [open])

  const closeMenu = React.useCallback(() => setOpen(false), [])
  const toggleMenu = React.useCallback(() => setOpen((v) => !v), [])

  return (
    <header
      className={cn(
        "fixed left-0 right-0 z-40 w-full bg-white/90 backdrop-blur-md transition-transform duration-300 ease-out",
        hidden ? "-translate-y-full" : "translate-y-0"
      )}
      style={colorVars}
    >
      <div className="mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 pb-1.5 pt-2.5 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1 text-(--nav-logo-color)"
          aria-label="Seqpulse home"
        >
          <SeqPulseLogoMark className="h-12 w-12 text-(--nav-logo-color)" />
          <span className="text-lg font-display font-semibold leading-none">Seqpulse</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors",
                "text-(--nav-link-color) hover:text-(--nav-logo-color)"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <Link
            href="/signin"
            className="rounded-[2px] border border-(--nav-border-color) bg-(--nav-signin-bg) px-4 py-2 text-sm font-mono font-medium text-(--nav-link-color) shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-neutral-50"
          >
            SIGN IN
          </Link>
          <Link
            href="/signup"
            className="rounded-[2px] bg-(--nav-cta-bg) font-mono px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
          >
            TRY IT FOR FREE
          </Link>
        </div>

        <button
          type="button"
          onClick={toggleMenu}
          className="relative z-50 flex size-10 items-center justify-center rounded-md text-(--nav-logo-color) sm:hidden transition-colors"
          aria-expanded={open}
          aria-label={open ? "Close navigation" : "Open navigation"}
        >
          <span className="sr-only">Toggle navigation</span>
          <span
            className={cn(
              "absolute h-0.5 w-5 rounded-full bg-current transition-all duration-200 ease-out",
              open ? "translate-y-0 rotate-45" : "-translate-y-2"
            )}
          />
          <span
            className={cn(
              "absolute h-0.5 w-5 rounded-full bg-current transition-all duration-150 ease-out",
              open ? "opacity-0" : "opacity-100"
            )}
          />
          <span
            className={cn(
              "absolute h-0.5 w-5 rounded-full bg-current transition-all duration-200 ease-out",
              open ? "translate-y-0 -rotate-45" : "translate-y-2"
            )}
          />
        </button>
      </div>

      <div
        ref={overlayRef}
        className="fixed left-0 right-0 z-30 hidden overflow-y-auto bg-[#fdfdfd] px-4 pb-6 pt-4 sm:px-6"
        style={{ top: "64px", height: "calc(100vh - 64px)" }}
      >

        <div className="mt-8 flex flex-col gap-3 text-base font-medium">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className="rounded-md px-2 py-2 text-(--nav-link-color) transition-colors hover:bg-neutral-100"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3">
          <Link
            href="/signin"
            onClick={closeMenu}
            className="rounded-[2px] border border-(--nav-border-color) bg-(--nav-signin-bg) px-4 py-2 text-center text-sm font-medium text-(--nav-link-color) shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            SIGN IN
          </Link>
          <Link
            href="/signup"
            onClick={closeMenu}
            className="rounded-[2px] bg-(--nav-cta-bg) font-mono px-4 py-2 text-center text-sm font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
          >
            TRY IT FOR FREE
          </Link>
        </div>
      </div>
    </header>
  )
}
