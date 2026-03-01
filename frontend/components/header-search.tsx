"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { IconSearch } from "@tabler/icons-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useHeaderSearch } from "@/hooks/use-header-search"

function emitSearchEvent(name: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return
  const detail = { name, ts: Date.now(), ...payload }
  window.dispatchEvent(new CustomEvent("seqpulse:search", { detail }))
}

type HeaderSearchProps = {
  placeholder: string
  shortcutHint: string
}

export function HeaderSearch({ placeholder, shortcutHint }: HeaderSearchProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const desktopContainerRef = React.useRef<HTMLDivElement>(null)
  const desktopInputRef = React.useRef<HTMLInputElement>(null)
  const mobileInputRef = React.useRef<HTMLInputElement>(null)
  const openAtRef = React.useRef<number | null>(null)
  const lastNoResultsRef = React.useRef<string>("")
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)

  const { loading, sections, flatResults, debouncedQuery, hasData } = useHeaderSearch({
    query,
    isOpen: open,
  })
  const activeResult = flatResults[activeIndex]
  const listboxId = isMobile
    ? "header-search-results-mobile"
    : "header-search-results-desktop"
  const activeDescendant = activeResult
    ? `header-search-option-${itemDomId(activeResult.id)}`
    : undefined

  const openSearch = React.useCallback(
    (source: "shortcut" | "focus" | "mobile_button" = "shortcut") => {
      setOpen(true)
      setActiveIndex(0)
      if (!isMobile) {
        desktopInputRef.current?.focus()
        desktopInputRef.current?.select()
      }
      if (openAtRef.current === null) {
        openAtRef.current = Date.now()
        emitSearchEvent("search_opened", { source })
      }
    },
    [isMobile]
  )

  const closeSearch = React.useCallback(() => {
    setOpen(false)
    setActiveIndex(0)
    openAtRef.current = null
  }, [])

  const onResultClick = React.useCallback(
    (href: string, type: string, rank: number) => {
      emitSearchEvent("search_result_clicked", {
        type,
        rank,
        latency_ms: openAtRef.current ? Date.now() - openAtRef.current : null,
        query: debouncedQuery,
      })
      closeSearch()
      setQuery("")
      router.push(href)
    },
    [closeSearch, debouncedQuery, router]
  )

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        openSearch("shortcut")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [openSearch])

  React.useEffect(() => {
    if (!open || isMobile) return
    const onMouseDown = (event: MouseEvent) => {
      if (!desktopContainerRef.current) return
      if (!desktopContainerRef.current.contains(event.target as Node)) {
        closeSearch()
      }
    }
    window.addEventListener("mousedown", onMouseDown)
    return () => window.removeEventListener("mousedown", onMouseDown)
  }, [closeSearch, isMobile, open])

  React.useEffect(() => {
    if (!isMobile || !open) return
    const handle = window.setTimeout(() => {
      mobileInputRef.current?.focus()
      mobileInputRef.current?.select()
    }, 10)
    return () => window.clearTimeout(handle)
  }, [isMobile, open])

  React.useEffect(() => {
    if (!open) return
    emitSearchEvent("search_query_changed", { query: debouncedQuery })
  }, [debouncedQuery, open])

  React.useEffect(() => {
    if (!open) return
    const normalized = debouncedQuery.trim().toLowerCase()
    if (!normalized || flatResults.length > 0) return
    if (lastNoResultsRef.current === normalized) return
    lastNoResultsRef.current = normalized
    emitSearchEvent("search_no_results", { query: debouncedQuery })
  }, [debouncedQuery, flatResults.length, open])

  React.useEffect(() => {
    if (activeIndex <= flatResults.length - 1) return
    setActiveIndex(0)
  }, [activeIndex, flatResults.length])

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        setOpen(true)
      }
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      closeSearch()
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (flatResults.length === 0) return
      setActiveIndex((prev) => (prev + 1) % flatResults.length)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      if (flatResults.length === 0) return
      setActiveIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length)
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      if (flatResults.length === 0) return
      const selected = flatResults[activeIndex] ?? flatResults[0]
      if (!selected) return
      onResultClick(selected.href, selected.kind, activeIndex + 1)
    }
  }

  const renderResults = (className: string) => (
    <div id={listboxId} role="listbox" className={className}>
      {loading && !hasData ? (
        <div className="px-2 py-3 text-sm text-muted-foreground">Loading search data...</div>
      ) : flatResults.length === 0 ? (
        <div className="space-y-3 px-2 py-3">
          <p className="text-sm font-medium">No results</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Try `dpl_123` to open a deployment directly</li>
            <li>Try `verdict:warning` to inspect risky deployments</li>
            <li>Try `project:billing` to narrow by project</li>
          </ul>
        </div>
      ) : (
        <div className="max-h-96 overflow-auto">
          {sections.map((section) => (
            <div key={section.group} className="mb-2 last:mb-0">
              <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const rank = flatResults.findIndex((result) => result.id === item.id) + 1
                  const isActive = activeResult?.id === item.id
                  return (
                    <button
                      key={item.id}
                      id={`header-search-option-${itemDomId(item.id)}`}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      className={`flex w-full flex-col rounded px-2 py-2 text-left ${
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/60"
                      }`}
                      onMouseEnter={() => {
                        if (rank > 0) setActiveIndex(rank - 1)
                      }}
                      onClick={() => onResultClick(item.href, item.kind, rank)}
                    >
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      <div
        ref={desktopContainerRef}
        className="relative hidden md:block"
        onBlur={(event) => {
          if (isMobile) return
          const nextFocused = event.relatedTarget as Node | null
          if (nextFocused && desktopContainerRef.current?.contains(nextFocused)) return
          closeSearch()
        }}
      >
        <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={desktopInputRef}
          type="search"
          placeholder={placeholder}
          value={query}
          onFocus={() => openSearch("focus")}
          onChange={(event) => {
            setQuery(event.target.value)
            if (!open) {
              setOpen(true)
            }
          }}
          onKeyDown={onInputKeyDown}
          role="combobox"
          aria-expanded={open && !isMobile}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-keyshortcuts="Control+K Meta+K"
          className="w-64 pl-8 pr-16"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {shortcutHint}
        </kbd>

        {open && !isMobile &&
          renderResults(
            "absolute right-0 top-[calc(100%+8px)] z-50 w-[30rem] rounded-md border bg-popover p-2 shadow-lg"
          )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => openSearch("mobile_button")}
      >
        <IconSearch className="size-4" />
        <span className="sr-only">Open search</span>
      </Button>

      <Sheet
        open={isMobile && open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setOpen(true)
            return
          }
          closeSearch()
        }}
      >
        <SheetContent side="top" className="gap-0 p-0">
          <SheetHeader className="pb-3">
            <SheetTitle>Search</SheetTitle>
            <SheetDescription>
              Find deployments, projects, diagnostics, and routes quickly.
            </SheetDescription>
          </SheetHeader>
          <div className="border-t px-4 py-3">
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={mobileInputRef}
                type="search"
                placeholder={placeholder}
                value={query}
                onFocus={() => openSearch("focus")}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                role="combobox"
                aria-expanded={open && isMobile}
                aria-controls={listboxId}
                aria-activedescendant={activeDescendant}
                className="pl-8"
              />
            </div>
          </div>
          <div className="border-t p-2">
            {renderResults("max-h-[60vh] overflow-auto rounded-md")}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function itemDomId(rawId: string): string {
  return rawId.replace(/[^a-zA-Z0-9_-]/g, "-")
}
