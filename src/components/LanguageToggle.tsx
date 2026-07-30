import { useTranslation } from 'react-i18next'
import { setLocale } from '../i18n'

export function LanguageToggle() {
  const { t, i18n } = useTranslation()

  return (
    <div>
      <button type="button" onClick={() => setLocale('en')} disabled={i18n.language === 'en'}>
        {t('language.english')}
      </button>
      <button type="button" onClick={() => setLocale('th')} disabled={i18n.language === 'th'}>
        {t('language.thai')}
      </button>
    </div>
  )
}
