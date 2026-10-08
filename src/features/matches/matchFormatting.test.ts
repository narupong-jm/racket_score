import { describe, expect, it, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { formatMatchLabel } from './matchFormatting'

describe('formatMatchLabel', () => {
  const t = vi.fn((key: string, opts?: Record<string, unknown>) =>
    JSON.stringify([key, opts]),
  ) as unknown as TFunction

  it('uses the court-aware label on a multi-court tournament', () => {
    expect(
      formatMatchLabel(t, { sequence_number: 4, court_number: 2 }, 2),
    ).toBe(JSON.stringify(['manage.matchLabelCourt', { n: 4, court: 2 }]))
  })

  it('falls back to court 1 when court_number is null', () => {
    expect(
      formatMatchLabel(t, { sequence_number: 4, court_number: null }, 3),
    ).toBe(JSON.stringify(['manage.matchLabelCourt', { n: 4, court: 1 }]))
  })

  it('uses the plain label on a single-court tournament', () => {
    expect(
      formatMatchLabel(t, { sequence_number: 4, court_number: 1 }, 1),
    ).toBe(JSON.stringify(['manage.matchLabel', { n: 4 }]))
  })
})
