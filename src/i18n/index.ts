import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import th from './th.json'

export type Locale = 'en' | 'th'

export const LOCALE_STORAGE_KEY = 'racket-score-locale'

function getInitialLocale(): Locale {
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return stored === 'th' ? 'th' : 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    th: { translation: th },
  },
  lng: getInitialLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLocale(locale: Locale) {
  void i18n.changeLanguage(locale)
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
}

export default i18n
