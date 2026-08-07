import { describe, expect, it } from 'vitest'
import { isMixedDoublesRuleViolated } from './isMixedDoublesRuleViolated'
import type { CandidatePlayer } from './types'

function player(id: string, gender: 'male' | 'female'): CandidatePlayer {
  return { id, gender, skillValue: 50, matchesPlayedInTournament: 0 }
}

describe('isMixedDoublesRuleViolated', () => {
  it('flags a 2-2 quartet split into same-gender teams', () => {
    const p0 = player('p0', 'male')
    const p1 = player('p1', 'male')
    const p2 = player('p2', 'female')
    const p3 = player('p3', 'female')

    expect(isMixedDoublesRuleViolated([p0, p1, p2, p3], ['p0', 'p1'])).toBe(
      true,
    )
  })

  it('does not flag a 2-2 quartet split into mixed teams', () => {
    const p0 = player('p0', 'male')
    const p1 = player('p1', 'male')
    const p2 = player('p2', 'female')
    const p3 = player('p3', 'female')

    expect(isMixedDoublesRuleViolated([p0, p1, p2, p3], ['p0', 'p2'])).toBe(
      false,
    )
  })

  it('does not flag a 3-1 quartet, since no mixed split is achievable', () => {
    const p0 = player('p0', 'male')
    const p1 = player('p1', 'male')
    const p2 = player('p2', 'male')
    const p3 = player('p3', 'female')

    expect(isMixedDoublesRuleViolated([p0, p1, p2, p3], ['p0', 'p1'])).toBe(
      false,
    )
  })

  it('does not flag an all-male (4-0) quartet', () => {
    const p0 = player('p0', 'male')
    const p1 = player('p1', 'male')
    const p2 = player('p2', 'male')
    const p3 = player('p3', 'male')

    expect(isMixedDoublesRuleViolated([p0, p1, p2, p3], ['p0', 'p1'])).toBe(
      false,
    )
  })

  it('returns false for a non-quartet input instead of throwing', () => {
    const p0 = player('p0', 'male')
    const p1 = player('p1', 'female')

    expect(isMixedDoublesRuleViolated([p0, p1], ['p0'])).toBe(false)
  })

  it('returns false when team1Ids does not cleanly split the quartet in two', () => {
    const p0 = player('p0', 'male')
    const p1 = player('p1', 'male')
    const p2 = player('p2', 'female')
    const p3 = player('p3', 'female')

    expect(
      isMixedDoublesRuleViolated([p0, p1, p2, p3], ['p0', 'p1', 'p2']),
    ).toBe(false)
  })
})
