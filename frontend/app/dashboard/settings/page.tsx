"use client"

import { useState } from "react"
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
  IconWorld,
} from "@tabler/icons-react"

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
    emailNotifications,
    slackWebhookUrl,
    setSlackWebhookUrl,
    smsNumber,
    setSmsNumber,
  } = useSettingsStore()

  const [localUsername, setLocalUsername] = useState(username)
  const [localPassword, setLocalPassword] = useState("")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  
  // Billing state
  const [companyName, setCompanyName] = useState("")
  const [taxId, setTaxId] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("")
  const [postalCode, setPostalCode] = useState("")

  const handleSaveUsername = () => {
    setUsername(localUsername)
    toast.success(t('settings.account.save'))
  }

  const handleSavePassword = () => {
    if (localPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    toast.success(t('settings.account.save'))
    setLocalPassword("")
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

  const handleSaveBilling = () => {
    if (!companyName || !taxId || !address || !city || !country || !postalCode) {
      toast.error("Please fill all required fields")
      return
    }
    toast.success(t('settings.billing.save'))
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
            />
            <Button onClick={handleSaveUsername}>{t('settings.account.save')}</Button>
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
              id="password"
              type="password"
              value={localPassword}
              onChange={(e) => setLocalPassword(e.target.value)}
              placeholder={t('settings.account.password.placeholder')}
              className="max-w-md"
            />
            <Button onClick={handleSavePassword}>{t('settings.account.save')}</Button>
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
                twoFactorEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
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

      {/* Billing Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t('settings.billing.title')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company-name">
              {t('settings.billing.companyName.label')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t('settings.billing.companyName.placeholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax-id">
              {t('settings.billing.taxId.label')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="tax-id"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder={t('settings.billing.taxId.placeholder')}
              required
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">
              {t('settings.billing.address.label')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('settings.billing.address.placeholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">
              {t('settings.billing.city.label')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t('settings.billing.city.placeholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">
              {t('settings.billing.country.label')} <span className="text-red-500">*</span>
            </Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="country">
                <SelectValue placeholder={t('settings.billing.country.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">United States</SelectItem>
                <SelectItem value="fr">France</SelectItem>
                <SelectItem value="de">Germany</SelectItem>
                <SelectItem value="es">Spain</SelectItem>
                <SelectItem value="cg">Congo</SelectItem>
                <SelectItem value="uk">United Kingdom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="postal-code">
              {t('settings.billing.postalCode.label')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="postal-code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder={t('settings.billing.postalCode.placeholder')}
              required
            />
          </div>
        </div>
        <Button onClick={handleSaveBilling} className="w-full md:w-auto">
          {t('settings.billing.save')}
        </Button>
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
              <p className="text-sm text-muted-foreground">gouombanassir@gmail.com</p>
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