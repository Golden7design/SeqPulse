"use client"

import { useEffect, useState } from "react"
import { useSettingsStore } from "@/store/use-settings-store"
import { useTranslation } from "@/components/providers/i18n-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  IconAt,
  IconBrandSlack,
  IconMessage,
} from "@tabler/icons-react"
import { TwoFAQrPreview } from "@/components/twofa-qr-preview"
import {
  changePassword,
  disableTwoFA,
  fetchCurrentUserFromSession,
  fetchTwoFAStatus,
  regenerateTwoFARecoveryCodes,
  setPassword,
  startTwoFASetup,
  TwoFASetupStartResponse,
  updateProfile,
  verifyTwoFASetup,
} from "@/lib/auth-client"

type PasswordStatusTone = "success" | "error" | "info"

type PasswordStatus = {
  tone: PasswordStatusTone
  message: string
}

const UPPERCASE_REGEX = /[A-Z]/
const LOWERCASE_REGEX = /[a-z]/
const DIGIT_REGEX = /\d/
const SPECIAL_CHAR_REGEX = /[@$!%*?&]/

function getPasswordPolicyErrors(password: string, t: (key: string) => string): string[] {
  const errors: string[] = []
  if (password.length < 8) {
    errors.push(t("settings.account.password.policy.minLength"))
  }
  if (!UPPERCASE_REGEX.test(password)) {
    errors.push(t("settings.account.password.policy.uppercase"))
  }
  if (!LOWERCASE_REGEX.test(password)) {
    errors.push(t("settings.account.password.policy.lowercase"))
  }
  if (!DIGIT_REGEX.test(password)) {
    errors.push(t("settings.account.password.policy.number"))
  }
  if (!SPECIAL_CHAR_REGEX.test(password)) {
    errors.push(t("settings.account.password.policy.specialChar"))
  }
  return errors
}

function formatTotpSecret(secret: string): string {
  const normalized = secret.replace(/\s+/g, "").toUpperCase()
  return normalized.match(/.{1,4}/g)?.join(" ") ?? normalized
}

function normalizeTotpInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8)
}

function normalizeRecoveryCodeInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32)
}

function legacyCopyToClipboard(value: string): boolean {
  if (typeof document === "undefined") {
    return false
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.top = "-9999px"
  textarea.style.left = "-9999px"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)

  textarea.focus({ preventScroll: true })
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  let copied = false
  try {
    copied = document.execCommand("copy")
  } catch {
    copied = false
  } finally {
    textarea.remove()
  }

  return copied
}

function buildRecoveryCodesFileContent(
  codes: string[],
  email: string,
  t: (key: string) => string
): string {
  const generatedAt = new Date().toISOString()
  return [
    t("settings.account.2fa.recoveryCodes.file.title"),
    `${t("settings.account.2fa.recoveryCodes.file.generatedAt")} ${generatedAt}`,
    `${t("settings.account.2fa.recoveryCodes.file.account")} ${email || t("common.unknown")}`,
    "",
    t("settings.account.2fa.recoveryCodes.file.keepSafe"),
    t("settings.account.2fa.recoveryCodes.file.oneTime"),
    "",
    ...codes.map((code, index) => `${index + 1}. ${code}`),
    "",
  ].join("\n")
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const {
    language,
    setLanguage,
    username,
    setUsername,
    email,
    setEmail,
    setTwoFactorEnabled,
    slackWebhookUrl,
    smsNumber,
  } = useSettingsStore()

  const [localUsername, setLocalUsername] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [localPassword, setLocalPassword] = useState("")
  const [hasPassword, setHasPassword] = useState(true)
  const [passwordStatus, setPasswordStatus] = useState<PasswordStatus | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingUsername, setIsSavingUsername] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [twoFaStatusLoading, setTwoFaStatusLoading] = useState(true)
  const [twoFaActionCode, setTwoFaActionCode] = useState("")
  const [useRecoveryCodeForAction, setUseRecoveryCodeForAction] = useState(false)
  const [twoFaSetup, setTwoFaSetup] = useState<TwoFASetupStartResponse | null>(null)
  const [isTwoFaStarting, setIsTwoFaStarting] = useState(false)
  const [isTwoFaVerifying, setIsTwoFaVerifying] = useState(false)
  const [isTwoFaDisabling, setIsTwoFaDisabling] = useState(false)
  const [isTwoFaRegenerating, setIsTwoFaRegenerating] = useState(false)
  const [twoFaError, setTwoFaError] = useState<string | null>(null)
  const [recoveryCodesRemaining, setRecoveryCodesRemaining] = useState(0)
  const [latestRecoveryCodes, setLatestRecoveryCodes] = useState<string[]>([])
  const [setupCode, setSetupCode] = useState("")
  const [hasTwoFaSetupSecret, setHasTwoFaSetupSecret] = useState(false)
  const [copiedField, setCopiedField] = useState<"secret" | "uri" | null>(null)
  const [twoFaEnabledServer, setTwoFaEnabledServer] = useState<boolean | null>(null)
  const [twoFaStatusError, setTwoFaStatusError] = useState<string | null>(null)
  const [isRefreshingTwoFaStatus, setIsRefreshingTwoFaStatus] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      try {
        const me = await fetchCurrentUserFromSession()
        if (cancelled) return
        setUsername(me.name)
        setEmail(me.email)
        setLocalUsername(me.name)
        setHasPassword(me.has_password ?? true)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : t("settings.account.profileLoadError")
        toast.error(message)
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false)
        }
      }

      try {
        const twoFaStatus = await fetchTwoFAStatus()
        if (cancelled) return
        setTwoFactorEnabled(twoFaStatus.enabled)
        setTwoFaEnabledServer(twoFaStatus.enabled)
        setRecoveryCodesRemaining(twoFaStatus.recovery_codes_remaining)
        setHasTwoFaSetupSecret(twoFaStatus.has_setup_secret)
        setTwoFaStatusError(null)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : t("settings.account.2fa.statusLoadError")
        setTwoFaStatusError(message)
        setTwoFaEnabledServer(null)
      } finally {
        if (!cancelled) {
          setTwoFaStatusLoading(false)
        }
      }
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [setEmail, setTwoFactorEnabled, setUsername, t])

  useEffect(() => {
    setLocalUsername(username)
  }, [username])

  const handleSaveUsername = async () => {
    if (!localUsername.trim()) {
      toast.error(t("settings.account.username.emptyError"))
      return
    }
    setIsSavingUsername(true)
    try {
      const updated = await updateProfile({ name: localUsername.trim() })
      setUsername(updated.name)
      setEmail(updated.email)
      setLocalUsername(updated.name)
      toast.success(t("settings.account.save"))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.account.profileUpdateError")
      toast.error(message)
    } finally {
      setIsSavingUsername(false)
    }
  }

  const handleSavePassword = async () => {
    setPasswordStatus(null)

    if (hasPassword && !currentPassword) {
      const message = t("settings.account.password.currentRequired")
      setPasswordStatus({ tone: "error", message })
      toast.error(message)
      return
    }

    const policyErrors = getPasswordPolicyErrors(localPassword, t)
    if (policyErrors.length > 0) {
      const message = policyErrors[0]
      setPasswordStatus({ tone: "error", message })
      toast.error(message)
      return
    }

    setIsSavingPassword(true)
    try {
      if (hasPassword) {
        await changePassword({
          current_password: currentPassword,
          new_password: localPassword,
        })
        setPasswordStatus({
          tone: "success",
          message: t("settings.account.password.changedStatus"),
        })
        toast.success(t("settings.account.password.changedSuccess"))
      } else {
        await setPassword({
          new_password: localPassword,
        })
        setHasPassword(true)
        setPasswordStatus({
          tone: "success",
          message: t("settings.account.password.setStatus"),
        })
        toast.success(t("settings.account.password.setSuccess"))
      }
      setCurrentPassword("")
      setLocalPassword("")
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.account.password.updateError")
      setPasswordStatus({ tone: "error", message })
      toast.error(message)
    } finally {
      setIsSavingPassword(false)
    }
  }

  const resetTwoFaActionInputs = () => {
    setTwoFaActionCode("")
    setUseRecoveryCodeForAction(false)
  }

  const handleRefreshTwoFaStatus = async () => {
    setIsRefreshingTwoFaStatus(true)
    setTwoFaStatusError(null)
    try {
      const twoFaStatus = await fetchTwoFAStatus()
      setTwoFactorEnabled(twoFaStatus.enabled)
      setTwoFaEnabledServer(twoFaStatus.enabled)
      setRecoveryCodesRemaining(twoFaStatus.recovery_codes_remaining)
      setHasTwoFaSetupSecret(twoFaStatus.has_setup_secret)
      toast.success(t("settings.account.2fa.statusRefreshed"))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.account.2fa.statusLoadError")
      setTwoFaStatusError(message)
      setTwoFaEnabledServer(null)
      toast.error(message)
    } finally {
      setIsRefreshingTwoFaStatus(false)
    }
  }

  const copyToClipboard = async (value: string, field: "secret" | "uri") => {
    try {
      const canUseNavigatorClipboard =
        typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        Boolean(navigator.clipboard?.writeText) &&
        Boolean(window.isSecureContext)

      if (canUseNavigatorClipboard) {
        await navigator.clipboard.writeText(value)
      } else if (!legacyCopyToClipboard(value)) {
        throw new Error(t("settings.account.2fa.clipboardUnavailable"))
      }

      setCopiedField(field)
      window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1800)
      toast.success(
        field === "secret"
          ? t("settings.account.2fa.secretCopied")
          : t("settings.account.2fa.uriCopied")
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.account.2fa.copyError")
      toast.error(message)
    }
  }

  const handleTwoFaSetupStart = async () => {
    setTwoFaError(null)
    setTwoFaStatusError(null)
    setLatestRecoveryCodes([])
    setCopiedField(null)
    setIsTwoFaStarting(true)
    try {
      const setup = await startTwoFASetup()
      setTwoFaSetup(setup)
      setHasTwoFaSetupSecret(true)
      setSetupCode("")
      toast.success(t("settings.account.2fa.setupStarted"))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.account.2fa.setupStartError")
      setTwoFaError(message)
      toast.error(message)
    } finally {
      setIsTwoFaStarting(false)
    }
  }

  const handleTwoFaSetupVerify = async () => {
    setTwoFaError(null)
    if (!setupCode.trim()) {
      const message = t("settings.account.2fa.setupCodeRequired")
      setTwoFaError(message)
      toast.error(message)
      return
    }
    setIsTwoFaVerifying(true)
    try {
      const result = await verifyTwoFASetup({ code: setupCode.trim() })
      setTwoFactorEnabled(true)
      setTwoFaEnabledServer(true)
      setTwoFaSetup(null)
      setHasTwoFaSetupSecret(false)
      setSetupCode("")
      setLatestRecoveryCodes(result.recovery_codes)
      setRecoveryCodesRemaining(result.recovery_codes_remaining)
      toast.success(t("settings.account.2fa.enabledSuccess"))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.account.2fa.setupVerifyError")
      setTwoFaError(message)
      toast.error(message)
    } finally {
      setIsTwoFaVerifying(false)
    }
  }

  const handleTwoFaDisable = async () => {
    setTwoFaError(null)
    if (!twoFaActionCode.trim()) {
      const message = useRecoveryCodeForAction
        ? t("settings.account.2fa.disableRecoveryCodeRequired")
        : t("settings.account.2fa.disableAuthenticatorCodeRequired")
      setTwoFaError(message)
      toast.error(message)
      return
    }

    setIsTwoFaDisabling(true)
    try {
      await disableTwoFA({
        code: twoFaActionCode.trim(),
        use_recovery_code: useRecoveryCodeForAction,
      })
      setTwoFactorEnabled(false)
      setTwoFaEnabledServer(false)
      setRecoveryCodesRemaining(0)
      setLatestRecoveryCodes([])
      setTwoFaSetup(null)
      setHasTwoFaSetupSecret(false)
      resetTwoFaActionInputs()
      toast.success(t("settings.account.2fa.disabledSuccess"))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.account.2fa.disableError")
      setTwoFaError(message)
      toast.error(message)
    } finally {
      setIsTwoFaDisabling(false)
    }
  }

  const handleRegenerateRecoveryCodes = async () => {
    setTwoFaError(null)
    if (!twoFaActionCode.trim()) {
      const message = useRecoveryCodeForAction
        ? t("settings.account.2fa.regenerateRecoveryCodeRequired")
        : t("settings.account.2fa.regenerateAuthenticatorCodeRequired")
      setTwoFaError(message)
      toast.error(message)
      return
    }
    setIsTwoFaRegenerating(true)
    try {
      const result = await regenerateTwoFARecoveryCodes({
        code: twoFaActionCode.trim(),
        use_recovery_code: useRecoveryCodeForAction,
      })
      setLatestRecoveryCodes(result.recovery_codes)
      setRecoveryCodesRemaining(result.recovery_codes_remaining)
      resetTwoFaActionInputs()
      toast.success(t("settings.account.2fa.recoveryCodes.regeneratedSuccess"))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("settings.account.2fa.recoveryCodes.regenerateError")
      setTwoFaError(message)
      toast.error(message)
    } finally {
      setIsTwoFaRegenerating(false)
    }
  }

  const handleDownloadRecoveryCodes = () => {
    if (latestRecoveryCodes.length === 0) {
      toast.error(t("settings.account.2fa.recoveryCodes.noneToDownload"))
      return
    }
    if (typeof window === "undefined") {
      toast.error(t("settings.account.2fa.recoveryCodes.downloadUnavailable"))
      return
    }

    const payload = buildRecoveryCodesFileContent(latestRecoveryCodes, email, t)
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `seqpulse-recovery-codes-${stamp}.txt`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
    toast.success(t("settings.account.2fa.recoveryCodes.downloadedSuccess"))
  }

  const handleLanguageChange = (value: string) => {
    setLanguage(value as 'en' | 'fr' | 'es' | 'de')
    toast.success(t("settings.language.changed"))
  }

  const languages = [
    { code: 'en', name: t('languages.en'), flag: '🇬🇧' },
    { code: 'fr', name: t('languages.fr'), flag: '🇫🇷' },
    { code: 'es', name: t('languages.es'), flag: '🇪🇸' },
    { code: 'de', name: t('languages.de'), flag: '🇩🇪' },
  ]

  const isTwoFaEnabled = twoFaEnabledServer === true
  const isTwoFaDisabled = twoFaEnabledServer === false

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-4xl">
      {/* Account Section */}
      <div>
        <h2 className="text-2xl font-bold mb-1">{t('settings.account.title')}</h2>
      </div>

      <div className="space-y-6">
        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username">{t('settings.account.username.label')}</Label>
          <p className="text-sm text-muted-foreground">
            {t('settings.account.username.hint')}
          </p>
          <div className="flex gap-2">
            <Input
              id="username"
              value={localUsername}
              onChange={(e) => setLocalUsername(e.target.value)}
              maxLength={28}
              className="max-w-md"
              disabled={isLoadingProfile || isSavingUsername}
            />
            <Button
              onClick={handleSaveUsername}
              disabled={isLoadingProfile || isSavingUsername}
            >
              {isSavingUsername ? t("common.saving") : t("settings.account.save")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.account.username.maxLength')}
          </p>
        </div>

        <Separator />

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">{t('settings.account.password.label')}</Label>
          <p className="text-sm text-muted-foreground">
            {hasPassword
              ? t('settings.account.password.hint')
              : t("settings.account.password.socialHint")}
          </p>
          {hasPassword ? (
            <div className="flex gap-2">
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("settings.account.password.currentPlaceholder")}
                className="max-w-md"
                disabled={isSavingPassword}
              />
            </div>
          ) : null}
          <div className="flex gap-2">
            <Input
              id="password"
              type="password"
              value={localPassword}
              onChange={(e) => setLocalPassword(e.target.value)}
              placeholder={t('settings.account.password.placeholder')}
              className="max-w-md"
              disabled={isSavingPassword}
            />
            <Button onClick={handleSavePassword} disabled={isSavingPassword}>
              {isSavingPassword ? t("common.saving") : t("settings.account.save")}
            </Button>
          </div>
          {hasPassword && currentPassword ? (
            <p className="text-xs text-muted-foreground">
              {t("settings.account.password.currentWillBeVerified")}
            </p>
          ) : null}
          {localPassword ? (
            <div className="space-y-1">
              {getPasswordPolicyErrors(localPassword, t).length === 0 ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {t("settings.account.password.formatValid")}
                </p>
              ) : (
                getPasswordPolicyErrors(localPassword, t).map((error) => (
                  <p key={error} className="text-xs text-amber-600 dark:text-amber-400">
                    {error}
                  </p>
                ))
              )}
            </div>
          ) : null}
          {passwordStatus ? (
            <p
              className={
                passwordStatus.tone === "success"
                  ? "text-xs text-emerald-600 dark:text-emerald-400"
                  : passwordStatus.tone === "error"
                    ? "text-xs text-destructive"
                    : "text-xs text-muted-foreground"
              }
            >
              {passwordStatus.message}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t('settings.account.password.maxLength')}
          </p>
        </div>

        <Separator />

        {/* 2FA */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="2fa">{t('settings.account.2fa.label')}</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t('settings.account.2fa.hint')}
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                isTwoFaEnabled
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : twoFaEnabledServer === null
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isTwoFaEnabled ? t("common.enabled") : twoFaEnabledServer === null ? t("common.unknown") : t("common.disabled")}
            </span>
          </div>

          {twoFaStatusLoading ? (
            <p className="text-sm text-muted-foreground">{t("settings.account.2fa.loadingStatus")}</p>
          ) : null}

          {!twoFaStatusLoading && twoFaEnabledServer === null ? (
            <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t("settings.account.2fa.statusLoadServerError")}
              </p>
              {twoFaStatusError ? (
                <p className="text-xs text-amber-700/90 dark:text-amber-300/90">{twoFaStatusError}</p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={handleRefreshTwoFaStatus}
                disabled={isRefreshingTwoFaStatus}
              >
                {isRefreshingTwoFaStatus ? t("common.retrying") : t("settings.account.2fa.retryStatus")}
              </Button>
            </div>
          ) : null}

          {isTwoFaDisabled ? (
            <div className="space-y-3 pt-2">
              <Button
                onClick={handleTwoFaSetupStart}
                disabled={isTwoFaStarting || isTwoFaVerifying}
              >
                {isTwoFaStarting
                  ? t("settings.account.2fa.startingSetup")
                  : hasTwoFaSetupSecret
                    ? t("settings.account.2fa.restartSetup")
                    : t("settings.account.2fa.startSetup")}
              </Button>

              {twoFaSetup ? (
                <div className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">
                    {t("settings.account.2fa.setupStepScan")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.account.2fa.setupStepManual")}
                  </p>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <TwoFAQrPreview
                      value={twoFaSetup.otpauth_uri}
                      generatingLabel={t("settings.account.2fa.generatingQr")}
                    />
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("settings.account.2fa.issuer")}
                        </p>
                        <p className="text-sm font-medium">{twoFaSetup.issuer}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("settings.account.2fa.manualSetupKey")}
                        </p>
                        <p className="break-all rounded-md bg-muted/50 px-2 py-1 text-sm font-mono">
                          {formatTotpSecret(twoFaSetup.secret)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(twoFaSetup.secret, "secret")}
                          >
                            {copiedField === "secret" ? t("common.copied") : t("settings.account.2fa.copyKey")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(twoFaSetup.otpauth_uri, "uri")}
                          >
                            {copiedField === "uri" ? t("common.copied") : t("settings.account.2fa.copyOtpAuthUri")}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("settings.account.2fa.brandingHint")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      id="2fa-setup-code"
                      value={setupCode}
                      onChange={(e) => setSetupCode(normalizeTotpInput(e.target.value))}
                      placeholder={t("settings.account.2fa.codePlaceholder")}
                      className="max-w-md"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                    />
                    <Button
                      onClick={handleTwoFaSetupVerify}
                      disabled={isTwoFaVerifying || setupCode.length < 6}
                    >
                      {isTwoFaVerifying ? t("common.verifying") : t("settings.account.2fa.enableAction")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : isTwoFaEnabled ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                {t("settings.account.2fa.recoveryCodes.remainingLabel")} {recoveryCodesRemaining}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="2fa-action-code"
                  value={twoFaActionCode}
                  onChange={(e) =>
                    setTwoFaActionCode(
                      useRecoveryCodeForAction
                        ? normalizeRecoveryCodeInput(e.target.value)
                        : normalizeTotpInput(e.target.value)
                    )
                  }
                  placeholder={useRecoveryCodeForAction ? t("settings.account.2fa.recoveryCodePlaceholder") : t("settings.account.2fa.placeholder")}
                  className="max-w-md"
                  inputMode={useRecoveryCodeForAction ? "text" : "numeric"}
                  autoComplete="one-time-code"
                />
                <Button
                  variant="outline"
                  onClick={handleRegenerateRecoveryCodes}
                  disabled={isTwoFaRegenerating || isTwoFaDisabling || !twoFaActionCode.trim()}
                >
                  {isTwoFaRegenerating ? t("settings.account.2fa.regenerating") : t("settings.account.2fa.regenerateAction")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleTwoFaDisable}
                  disabled={isTwoFaDisabling || isTwoFaRegenerating || !twoFaActionCode.trim()}
                >
                  {isTwoFaDisabling ? t("settings.account.2fa.disabling") : t("settings.account.2fa.disableAction")}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={useRecoveryCodeForAction}
                  onChange={(event) => {
                    setUseRecoveryCodeForAction(event.target.checked)
                    setTwoFaActionCode("")
                  }}
                />
                {t("settings.account.2fa.useRecoveryCode")}
              </label>
            </div>
          ) : null}

          {twoFaError ? <p className="text-sm text-destructive">{twoFaError}</p> : null}

          {latestRecoveryCodes.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {t("settings.account.2fa.recoveryCodes.saveNowHint")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadRecoveryCodes}
              >
                {t("settings.account.2fa.recoveryCodes.downloadAction")}
              </Button>
              <div className="grid gap-2 sm:grid-cols-2">
                {latestRecoveryCodes.map((code) => (
                  <code key={code} className="rounded bg-background px-2 py-1 text-xs">
                    {code}
                  </code>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Language Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t('settings.language.title')}</h2>
        <div className="space-y-2">
          <Label>{t('settings.language.label')}</Label>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Notification Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t('settings.notification.title')}</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg border">
            <IconAt className="size-6 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{t('settings.notification.email')}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border">
            <IconBrandSlack className="size-6 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{t('settings.notification.slackWebhook')}</p>
              <p className="text-sm text-muted-foreground break-all">{slackWebhookUrl}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border">
            <IconMessage className="size-6 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{t('settings.notification.sms')}</p>
              <p className="text-sm text-muted-foreground">{smsNumber}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
