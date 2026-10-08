import { describe, expect, it } from 'vitest'
import en from './en.json'
import th from './th.json'

function flatten(obj: unknown, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object') Object.assign(out, flatten(v, key))
      else out[key] = v
    }
  }
  return out
}

const PHASE_24_KEYS = [
  'tournaments.form.courtsLabel',
  'tournaments.firstMatchPopup.titleMulti',
  'tournaments.firstMatchPopup.titleSingle',
  'tournaments.firstMatchPopup.rowEdit',
  'tournaments.firstMatchPopup.rowDone',
  'tournaments.firstMatchPopup.reusedWarning',
  'manage.courtsHeading',
  'manage.courtHeading',
  'manage.courtMatchHeading',
  'manage.courtFree',
  'manage.startOnCourt',
  'manage.startOnCourtWith',
  'manage.startNeedsQueue',
  'manage.startBlocked',
  'manage.queueHeading',
  'manage.queueEmpty',
  'manage.queueFull',
  'manage.fillQueue',
  'manage.removeFromQueue',
  'manage.queueReusedWarning',
  'manage.editQueueTitle',
  'manage.nowColumn',
  'manage.nowCourt',
  'manage.nowQueue',
  'manage.nowFree',
  'manage.done',
  'manage.matchLabel',
  'manage.matchLabelCourt',
  'manage.matchesPlayedHeading',
  'manage.noMatchesPlayed',
  'manage.saveResultNeedsQueue',
  'manage.confirmCancelBodyMulti',
  'active.matchLabel',
]

describe('locale parity', () => {
  const enFlat = flatten(en)
  const thFlat = flatten(th)

  it('en.json and th.json have identical key sets', () => {
    expect(Object.keys(thFlat).sort()).toEqual(Object.keys(enFlat).sort())
  })

  it.each(PHASE_24_KEYS)('%s is a non-empty string in both locales', (key) => {
    for (const flat of [enFlat, thFlat]) {
      expect(typeof flat[key]).toBe('string')
      expect((flat[key] as string).trim().length).toBeGreaterThan(0)
    }
  })

  it('preserves interpolation placeholders across locales', () => {
    const placeholders = (s: unknown) =>
      (String(s).match(/\{\{\w+\}\}/g) ?? []).sort()
    for (const key of Object.keys(enFlat)) {
      expect(placeholders(thFlat[key]), key).toEqual(placeholders(enFlat[key]))
    }
  })
})
