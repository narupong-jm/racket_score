import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { LanguageToggle } from './LanguageToggle'
import i18n, { LOCALE_STORAGE_KEY } from '../i18n'

afterEach(async () => {
  window.localStorage.removeItem(LOCALE_STORAGE_KEY)
  await i18n.changeLanguage('en')
})

describe('LanguageToggle / i18n setup', () => {
  it('renders English labels when the locale is en', async () => {
    await i18n.changeLanguage('en')

    render(<LanguageToggle />)

    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thai' })).toBeInTheDocument()
  })

  it('renders Thai labels when the locale is th', async () => {
    await i18n.changeLanguage('th')

    render(<LanguageToggle />)

    expect(screen.getByRole('button', { name: 'อังกฤษ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ไทย' })).toBeInTheDocument()
  })

  it('persists the chosen locale to localStorage when toggled', async () => {
    await i18n.changeLanguage('en')
    const user = userEvent.setup()

    render(<LanguageToggle />)

    await user.click(screen.getByRole('button', { name: 'Thai' }))

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('th')
    expect(i18n.language).toBe('th')
  })
})
