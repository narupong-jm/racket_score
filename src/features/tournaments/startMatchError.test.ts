import { describe, expect, it } from 'vitest'
import { startMatchErrorKey } from './startMatchError'

describe('startMatchErrorKey', () => {
  it.each([
    ['court_occupied', 'manage.startFailedOccupied'],
    ['participant_on_court', 'manage.startFailedPlayerBusy'],
    ['tournament_not_active', 'manage.startFailedInactive'],
    ['invalid_court', 'manage.startFailed'],
    ['some network failure', 'manage.startFailed'],
  ])('maps %s to %s', (message, key) => {
    expect(startMatchErrorKey(new Error(message))).toBe(key)
  })

  it('shows nothing when the user dismissed the passphrase prompt', () => {
    expect(startMatchErrorKey(new Error('passphrase_cancelled'))).toBeNull()
  })

  it('falls back to the generic message for non-Error rejections', () => {
    expect(startMatchErrorKey('boom')).toBe('manage.startFailed')
    expect(startMatchErrorKey(undefined)).toBe('manage.startFailed')
  })
})
