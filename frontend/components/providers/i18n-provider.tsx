"use client"

import { useSettingsStore } from '@/store/use-settings-store'
import { useEffect, useState } from 'react'

type Messages = {
  [key: string]: any
}

const loadMessages = async (locale: string): Promise<Messages> => {
  try {
    const messages = await import(`@/locales/${locale}.json`)
    return messages.default
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error)
    // Fallback to English
    const messages = await import(`@/locales/en.json`)
    return messages.default
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSettingsStore((state) => state.language)
  const [messages, setMessages] = useState<Messages | null>(null)

  useEffect(() => {
    loadMessages(language).then(setMessages)
  }, [language])

  if (!messages) {
    return <div>Loading...</div>
  }

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
    let value: any = context.messages

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return key // Return key if translation not found
      }
    }

    return typeof value === 'string' ? value : key
  }

  return { t, locale: context.locale }
}