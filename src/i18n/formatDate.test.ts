import { describe, expect, it } from 'vitest'
import { formatDate } from './formatDate'

const fixedDate = new Date('2026-03-05T00:00:00Z')

describe('formatDate', () => {
  it('formats the date in English (Gregorian year, English month name)', () => {
    const result = formatDate(fixedDate, 'en')

    expect(result).toContain('2026')
    expect(result).toMatch(/Mar/i)
  })

  it('formats the date in Thai (Buddhist Era year, Thai month name)', () => {
    const result = formatDate(fixedDate, 'th')

    expect(result).toContain('2569') // 2026 + 543 (Buddhist Era)
    expect(result).not.toContain('2026')
  })

  it('produces a different, locale-specific string for the same date', () => {
    const en = formatDate(fixedDate, 'en')
    const th = formatDate(fixedDate, 'th')

    expect(en).not.toBe(th)
  })

  it('accepts an ISO date string as well as a Date object', () => {
    const fromString = formatDate('2026-03-05T00:00:00Z', 'en')
    const fromDate = formatDate(fixedDate, 'en')

    expect(fromString).toBe(fromDate)
  })

  it('falls back to English formatting for an unrecognized locale', () => {
    const result = formatDate(fixedDate, 'fr')

    expect(result).toBe(formatDate(fixedDate, 'en'))
  })
})
