import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Language = 'en' | 'fr' | 'es' | 'de'

interface SettingsState {
  // Language
  language: Language
  setLanguage: (language: Language) => void

  // User settings
  username: string
  setUsername: (username: string) => void

  email: string
  setEmail: (email: string) => void

  twoFactorEnabled: boolean
  setTwoFactorEnabled: (enabled: boolean) => void

  // Notifications
  emailNotifications: boolean
  setEmailNotifications: (enabled: boolean) => void

  slackWebhookUrl: string
  setSlackWebhookUrl: (url: string) => void

  smsNumber: string
  setSmsNumber: (number: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Language
      language: 'en',
      setLanguage: (language) => set({ language }),

      // User settings
      username: '',
      setUsername: (username) => set({ username }),

      email: '',
      setEmail: (email) => set({ email }),

      twoFactorEnabled: false,
      setTwoFactorEnabled: (enabled) => set({ twoFactorEnabled: enabled }),

      // Notifications
      emailNotifications: true,
      setEmailNotifications: (enabled) => set({ emailNotifications: enabled }),

      slackWebhookUrl: 'https://hook.slack.com/services/T000/B000/XXX',
      setSlackWebhookUrl: (url) => set({ slackWebhookUrl: url }),

      smsNumber: '+242 06 878 59 39',
      setSmsNumber: (number) => set({ smsNumber: number }),
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        language: state.language,
        emailNotifications: state.emailNotifications,
        slackWebhookUrl: state.slackWebhookUrl,
        smsNumber: state.smsNumber,
      }),
    }
  )
)
