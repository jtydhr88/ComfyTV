import { createI18n } from 'vue-i18n'

import { app } from '@/lib/comfyApp'

import en from '../locales/en/main.json'
import zh from '../locales/zh/main.json'

export type SupportedLocale = 'en' | 'zh'

function pickLocale(): SupportedLocale {
  let stored: string | undefined
  try {
    stored = app?.ui?.settings?.getSettingValue?.('Comfy.Locale')
          ?? app?.extensionManager?.setting?.get?.('Comfy.Locale')
  } catch {
    stored = undefined
  }
  const candidate = (stored || navigator.language || 'en').toLowerCase()
  if (candidate.startsWith('zh')) return 'zh'
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: pickLocale(),
  fallbackLocale: 'en',
  messages: { en, zh },
  missingWarn: false,
  fallbackWarn: false,
})

export const t = i18n.global.t
