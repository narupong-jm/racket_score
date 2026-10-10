import { describe, expect, it } from 'vitest'
import { isNameTakenError, removeMemberErrorKey } from './playerErrors'

describe('removeMemberErrorKey', () => {
  it.each([
    ['player_has_matches', 'member.removeFailedHasMatches'],
    ['player_in_tournament', 'member.removeFailedInTournament'],
    ['not_a_member', 'member.removeFailed'],
    ['invalid_sport', 'member.removeFailed'],
    ['player_not_found', 'member.removeFailed'],
    ['some network failure', 'member.removeFailed'],
  ])('maps %s to %s', (message, key) => {
    expect(removeMemberErrorKey(new Error(message))).toBe(key)
  })

  it('shows nothing when the user dismissed the passphrase prompt', () => {
    expect(removeMemberErrorKey(new Error('passphrase_cancelled'))).toBeNull()
  })

  it('falls back to the generic message for non-Error rejections', () => {
    expect(removeMemberErrorKey('boom')).toBe('member.removeFailed')
    expect(removeMemberErrorKey(undefined)).toBe('member.removeFailed')
  })
})

describe('isNameTakenError', () => {
  it('is true when the error message is exactly name_taken', () => {
    expect(isNameTakenError(new Error('name_taken'))).toBe(true)
  })

  it('is true when the error message includes name_taken', () => {
    expect(isNameTakenError(new Error('duplicate key: name_taken'))).toBe(true)
  })

  it('is true for a Postgres unique_violation error code (23505)', () => {
    expect(isNameTakenError({ code: '23505', message: 'boom' })).toBe(true)
  })

  it('is false for an unrelated error', () => {
    expect(isNameTakenError(new Error('player_has_matches'))).toBe(false)
  })

  it('is false for a non-Error, non-object rejection', () => {
    expect(isNameTakenError('boom')).toBe(false)
    expect(isNameTakenError(undefined)).toBe(false)
  })
})
