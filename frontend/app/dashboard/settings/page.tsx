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
import {
  changePassword,
  fetchCurrentUserFromSession,
  updateProfile,
} from "@/lib/auth-client"

export default function SettingsPage() {
  const { t } = useTranslation()
  const {
    language,
    setLanguage,
    username,
    setUsername,
    email,
    setEmail,
    twoFactorEnabled,
    setTwoFactorEnabled,
    slackWebhookUrl,
    smsNumber,
  } = useSettingsStore()

  const [localUsername, setLocalUsername] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [localPassword, setLocalPassword] = useState("")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingUsername, setIsSavingUsername] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      try {
        const me = await fetchCurrentUserFromSession()
        if (cancelled) return
        setUsername(me.name)
        setEmail(me.email)
        setLocalUsername(me.name)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "Unable to load profile."
        toast.error(message)
      } finally {
        if (!cancelled) setIsLoadingProfile(false)
      }
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [setEmail, setUsername])

  useEffect(() => {
    setLocalUsername(username)
  }, [username])

  const handleSaveUsername = async () => {
    if (!localUsername.trim()) {
      toast.error("Username cannot be empty")
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
      const message = err instanceof Error ? err.message : "Unable to update profile."
      toast.error(message)
    } finally {
      setIsSavingUsername(false)
    }
  }

  const handleSavePassword = async () => {
    if (!currentPassword) {
      toast.error("Current password is required")
      return
    }
    if (localPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setIsSavingPassword(true)
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: localPassword,
      })
      toast.success(t("settings.account.save"))
      setCurrentPassword("")
      setLocalPassword("")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update password."
      toast.error(message)
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleConfirm2FA = () => {
    if (twoFactorCode.length !== 6) {
      toast.error("Code must be 6 digits")
      return
    }
    setTwoFactorEnabled(!twoFactorEnabled)
    toast.success(twoFactorEnabled ? "2FA disabled" : "2FA enabled")
    setTwoFactorCode("")
  }

  const handleLanguageChange = (value: string) => {
    setLanguage(value as 'en' | 'fr' | 'es' | 'de')
    toast.success(`Language changed to ${value.toUpperCase()}`)
  }

  const languages = [
    { code: 'en', name: t('languages.en'), flag: '🇬🇧' },
    { code: 'fr', name: t('languages.fr'), flag: '🇫🇷' },
    { code: 'es', name: t('languages.es'), flag: '🇪🇸' },
    { code: 'de', name: t('languages.de'), flag: '🇩🇪' },
  ]

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
              {isSavingUsername ? "Saving..." : t("settings.account.save")}
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
            {t('settings.account.password.hint')}
          </p>
          <div className="flex gap-2">
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="max-w-md"
              disabled={isSavingPassword}
            />
          </div>
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
              {isSavingPassword ? "Saving..." : t("settings.account.save")}
            </Button>
          </div>
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
            <button
              onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                twoFactorEnabled ? ' bg-gray-500 dark:bg-gray-800' : 'dark:bg-muted bg-accent-foreground'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {twoFactorEnabled && (
            <div className="flex gap-2 mt-2">
              <Input
                id="2fa"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('settings.account.2fa.placeholder')}
                maxLength={6}
                className="max-w-md"
              />
              <Button onClick={handleConfirm2FA}>{t('settings.account.confirm')}</Button>
            </div>
          )}
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
