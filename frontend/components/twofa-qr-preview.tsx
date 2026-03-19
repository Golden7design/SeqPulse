"use client"

import { useEffect, useMemo, useState } from "react"
import { SeqPulseLogoMark } from "@/components/seqpulse-logo-mark"

type QrFactory = (
  typeNumber: number,
  errorCorrectionLevel: "L" | "M" | "Q" | "H"
) => {
  addData: (data: string) => void
  make: () => void
  createSvgTag: (cellSize?: number, margin?: number) => string
}

declare global {
  interface Window {
    qrcode?: QrFactory
  }
}

const QR_LIB_CDN = "https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.js"
const QR_ERROR_CORRECTION_LEVEL = "H"
let qrLibPromise: Promise<void> | null = null

function loadQrLib(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.qrcode) return Promise.resolve()
  if (qrLibPromise) return qrLibPromise

  qrLibPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-twofa-qr-lib='1']")
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Failed to load QR library.")), {
        once: true,
      })
      return
    }

    const script = document.createElement("script")
    script.src = QR_LIB_CDN
    script.async = true
    script.dataset.twofaQrLib = "1"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load QR library."))
    document.head.appendChild(script)
  })

  return qrLibPromise
}

type TwoFAQrPreviewProps = {
  value: string
  className?: string
  generatingLabel?: string
}

function normalizeQrSvgMarkup(svg: string): string {
  if (!svg.includes("<svg")) {
    return svg
  }
  return svg.replace(
    "<svg",
    '<svg preserveAspectRatio="xMidYMid meet" style="display:block;margin:auto;"'
  )
}

export function TwoFAQrPreview({
  value,
  className,
  generatingLabel = "Generating QR...",
}: TwoFAQrPreviewProps) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const normalizedValue = useMemo(() => value.trim(), [value])

  useEffect(() => {
    let cancelled = false
    if (!normalizedValue) {
      setSvgMarkup(null)
      setError(null)
      return
    }

    const build = async () => {
      try {
        setError(null)
        await loadQrLib()
        if (cancelled) return
        if (!window.qrcode) {
          throw new Error("QR library unavailable.")
        }
        const qr = window.qrcode(0, QR_ERROR_CORRECTION_LEVEL)
        qr.addData(normalizedValue)
        qr.make()
        const svg = qr.createSvgTag(5, 2)
        if (!cancelled) {
          setSvgMarkup(normalizeQrSvgMarkup(svg))
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Unable to render QR code."
          setError(message)
          setSvgMarkup(null)
        }
      }
    }

    void build()
    return () => {
      cancelled = true
    }
  }, [normalizedValue])

  if (error) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      </div>
    )
  }

  if (!svgMarkup) {
    return (
      <div className={className}>
        <div className="flex h-47.5 w-47.5 items-center justify-center rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
          {generatingLabel}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="relative h-47.5 w-47.5">
        <div
          className="flex h-full w-full items-center justify-center rounded-xl border border-border bg-white p-2 leading-none [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center justify-center rounded-lg bg-white/95 p-1.5 shadow-sm ring-2 ring-white/90">
            <SeqPulseLogoMark className="h-10 w-10 text-black" />
          </div>
        </div>
      </div>
    </div>
  )
}
