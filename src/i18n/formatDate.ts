import type { Locale } from './index'

const INTL_LOCALE_TAG: Record<Locale, string> = {
  en: 'en-US',
  th: 'th-TH',
}

/** Formats a date per the given app locale (falls back to English for unknown locales). */
export function formatDate(date: string | Date, locale: string): string {
  const parsed = typeof date === 'string' ? new Date(date) : date
  const tag = INTL_LOCALE_TAG[locale as Locale] ?? INTL_LOCALE_TAG.en
  return new Intl.DateTimeFormat(tag, { dateStyle: 'medium' }).format(parsed)
}
