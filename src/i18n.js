import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en  from './locales/en.json'
import ar  from './locales/ar.json'
import ckb from './locales/ckb.json'

// RTL languages — applied to document.documentElement.dir
export const RTL_LANGS = new Set(['ar', 'ckb'])

export const LANGUAGES = [
  { code: 'en',  label: 'English',  nativeLabel: 'English',  dir: 'ltr' },
  { code: 'ar',  label: 'Arabic',   nativeLabel: 'العربية',  dir: 'rtl' },
  { code: 'ckb', label: 'Kurdish',  nativeLabel: 'کوردی',    dir: 'rtl' },
]

const STORAGE_KEY = 'irc.lang'

export function readStoredLang() {
  if (typeof window === 'undefined') return 'en'
  try { return localStorage.getItem(STORAGE_KEY) || 'en' } catch { return 'en' }
}

export function applyLangToDocument(lang) {
  if (typeof document === 'undefined') return
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
  document.documentElement.dir  = dir
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en:  { translation: en  },
      ar:  { translation: ar  },
      ckb: { translation: ckb },
    },
    lng: readStoredLang(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

applyLangToDocument(i18n.language)

export default i18n
