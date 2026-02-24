"use client"

import { useSettingsStore } from '@/store/use-settings-store'
import deMessages from '@/locales/de.json'
import enMessages from '@/locales/en.json'
import esMessages from '@/locales/es.json'
import frMessages from '@/locales/fr.json'
import { useEffect, useState } from 'react'

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
  const [messages, setMessages] = useState<Messages>(messagesByLocale[language] ?? messagesByLocale.en)

  useEffect(() => {
    setMessages(messagesByLocale[language] ?? messagesByLocale.en)
  }, [language])

  return <I18nContext.Provider value={{ messages, locale: language }}>{children}</I18nContext.Provider>
}

import { createContext, useContext } from 'react'

const I18nContext = createContext<{ messages: Messages; locale: string } | null>(null)

export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider')
  }

  const t = (key: string): string => {
    const keys = key.split('.')
    let value: unknown = context.messages

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k]
      } else {
        return key // Return key if translation not found
      }
    }

    return typeof value === 'string' ? value : key
  }

  return { t, locale: context.locale }
}
