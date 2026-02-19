"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useTranslation } from "@/components/providers/i18n-provider"
import {
  fetchCurrentUserFromSession,
  verifyTwoFAChallenge,
} from "@/lib/auth-client"
import { useSettingsStore } from "@/store/use-settings-store"

const OTP_LENGTH = 6

function emptyOtpDigits(): string[] {
  return Array.from({ length: OTP_LENGTH }, () => "")
}

function formatRemainingSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function normalizeRecoveryCodeInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32)
}

export default function TwoFAChallengePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const setUsername = useSettingsStore((state) => state.setUsername)
  const setEmail = useSettingsStore((state) => state.setEmail)

  const challengeId = searchParams.get("challenge_id")
  const expiresAtRaw = searchParams.get("expires_at")
  const expiresAtLabel = useMemo(() => {
    if (!expiresAtRaw) return null
    const parsed = new Date(expiresAtRaw)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleString()
  }, [expiresAtRaw])

  const [otpDigits, setOtpDigits] = useState<string[]>(() => emptyOtpDigits())
  const [recoveryCode, setRecoveryCode] = useState("")
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])

  const otpCode = useMemo(() => otpDigits.join(""), [otpDigits])
  const isExpired = secondsLeft !== null && secondsLeft <= 0
  const isSubmitDisabled =
    isSubmitting ||
    isExpired ||
    (useRecoveryCode ? recoveryCode.trim().length === 0 : otpCode.length < OTP_LENGTH)

  useEffect(() => {
    if (!expiresAtRaw) {
      setSecondsLeft(null)
      return
    }

    const expiresAtMs = new Date(expiresAtRaw).getTime()
    if (Number.isNaN(expiresAtMs)) {
      setSecondsLeft(null)
      return
    }

    const tick = () => {
      const next = Math.floor((expiresAtMs - Date.now()) / 1000)
      setSecondsLeft(Math.max(0, next))
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAtRaw])

  const focusOtpInput = (index: number) => {
    const field = otpRefs.current[index]
    if (field) {
      field.focus()
      field.select()
    }
  }

  const setOtpFromRaw = (startIndex: number, rawDigits: string) => {
    const normalized = rawDigits.replace(/\D/g, "")
    if (!normalized) return

    setOtpDigits((previous) => {
      const next = [...previous]
      let cursor = startIndex
      for (const digit of normalized) {
        if (cursor >= OTP_LENGTH) break
        next[cursor] = digit
        cursor += 1
      }
      return next
    })

    const nextFocusIndex = Math.min(startIndex + normalized.length, OTP_LENGTH - 1)
    focusOtpInput(nextFocusIndex)
  }

  const handleOtpDigitChange = (index: number, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "")
    if (!digits) {
      setOtpDigits((previous) => {
        const next = [...previous]
        next[index] = ""
        return next
      })
      return
    }
    setOtpFromRaw(index, digits)
  }

  const handleOtpKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      focusOtpInput(index - 1)
      setOtpDigits((previous) => {
        const next = [...previous]
        next[index - 1] = ""
        return next
      })
      return
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault()
      focusOtpInput(index - 1)
      return
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault()
      focusOtpInput(index + 1)
    }
  }

  const handleOtpPaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>
  ) => {
    const pasted = event.clipboardData.getData("text")
    const digits = pasted.replace(/\D/g, "")
    if (!digits) return
    event.preventDefault()
    setOtpFromRaw(index, digits)
  }

  const toggleRecoveryMode = (checked: boolean) => {
    setUseRecoveryCode(checked)
    setError(null)
    setOtpDigits(emptyOtpDigits())
    setRecoveryCode("")
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!challengeId) {
      setError(t("auth.errors.twofaChallengeMissingRestart"))
      return
    }
    if (isExpired) {
      setError(t("auth.twofaChallenge.expiredRestart"))
      return
    }

    const factorCode = useRecoveryCode ? recoveryCode.trim() : otpCode
    if (!useRecoveryCode && factorCode.length < OTP_LENGTH) {
      setError(t("auth.twofaChallenge.enterAuthenticatorCode"))
      return
    }
    if (useRecoveryCode && !factorCode) {
      setError(t("auth.twofaChallenge.enterRecoveryCode"))
      return
    }

    setIsSubmitting(true)
    try {
      await verifyTwoFAChallenge({
        code: factorCode,
        challenge_id: challengeId,
        use_recovery_code: useRecoveryCode,
      })
      const me = await fetchCurrentUserFromSession()
      setUsername(me.name)
      setEmail(me.email)
      router.replace("/dashboard")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("auth.errors.twofaVerifyFailed")
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold">{t("auth.twofaChallenge.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.twofaChallenge.subtitle")}
        </p>
        {secondsLeft !== null ? (
          <p className={`text-xs ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
            {isExpired
              ? t("auth.twofaChallenge.expiredRestart")
              : `${t("auth.twofaChallenge.codeWindow")} ${formatRemainingSeconds(secondsLeft)}`}
          </p>
        ) : expiresAtLabel ? (
          <p className="text-xs text-muted-foreground">
            {t("auth.twofaChallenge.expiresAt")} {expiresAtLabel}
          </p>
        ) : null}
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {useRecoveryCode ? (
          <div className="space-y-2">
            <label htmlFor="recovery-code" className="block text-sm font-medium">
              {t("auth.twofaChallenge.recoveryCodeLabel")}
            </label>
            <input
              id="recovery-code"
              className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(normalizeRecoveryCodeInput(event.target.value))}
              placeholder={t("auth.twofaChallenge.recoveryCodePlaceholder")}
              autoComplete="one-time-code"
              required
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t("auth.twofaChallenge.codeLabel")}</label>
            <div className="flex items-center justify-center gap-2">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    otpRefs.current[index] = element
                  }}
                  value={digit}
                  onChange={(event) => handleOtpDigitChange(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  onPaste={(event) => handleOtpPaste(index, event)}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  className="h-11 w-11 rounded-xl border border-border/70 bg-background text-center text-lg font-semibold outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  aria-label={`${t("auth.twofaChallenge.digitAriaLabel")} ${index + 1}`}
                  autoFocus={index === 0}
                />
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={useRecoveryCode}
            onChange={(event) => toggleRecoveryMode(event.target.checked)}
          />
          {t("auth.twofaChallenge.useRecoveryCode")}
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="inline-flex w-full items-center justify-center rounded-xl bg-foreground px-3.5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? t("common.verifying") : t("auth.twofaChallenge.verifyAndContinue")}
        </button>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center rounded-xl border border-border/70 bg-background px-3.5 py-2.5 text-sm font-medium transition hover:bg-muted/60"
          onClick={() => router.replace("/auth")}
        >
          {t("auth.common.backToSignIn")}
        </button>
      </form>
    </div>
  )
}
