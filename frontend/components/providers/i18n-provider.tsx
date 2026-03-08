"use client"

import { useSettingsStore } from '@/store/use-settings-store'
import deMessages from '@/locales/de.json'
import enMessages from '@/locales/en.json'
import esMessages from '@/locales/es.json'
import frMessages from '@/locales/fr.json'
import { useMemo } from 'react'

type Messages = {
  [key: string]: unknown
}

const messagesByLocale: Record<string, Messages> = {
  de: deMessages as Messages,
  en: enMessages as Messages,
  es: esMessages as Messages,
  fr: frMessages as Messages,
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSettingsStore((state) => state.language)
  const messages = useMemo(
    () => messagesByLocale[language] ?? messagesByLocale.en,
    [language]
  )

  return <I18nContext.Provider value={{ messages, locale: language }}>{children}</I18nContext.Provider>
}

import { createContext, useContext } from 'react'

const I18nContext = createContext<{ messages: Messages; locale: string } | null>(null)

export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider')
  }

  const t = (
    key: string,
    params?: Record<string, string | number | boolean | null | undefined>
  ): string => {
    const keys = key.split('.')
    let value: unknown = context.messages

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k]
      } else {
        return key // Return key if translation not found
      }
    }

    if (typeof value !== "string") return key
    if (!params) return value
    return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, token: string) => {
      const replacement = params[token]
      if (replacement === undefined || replacement === null) {
        return `{${token}}`
      }
      return String(replacement)
    })
  }

  return { t, locale: context.locale }
}
