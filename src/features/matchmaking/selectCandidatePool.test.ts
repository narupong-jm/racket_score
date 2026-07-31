import { describe, expect, it } from 'vitest'
import { selectCandidatePool } from './selectCandidatePool'
import type { CandidatePlayer } from './types'

function player(
  id: string,
  matchesPlayedInTournament: number,
  gender: 'male' | 'female' = 'male',
  skillValue = 50,
): CandidatePlayer {
  return { id, gender, skillValue, matchesPlayedInTournament }
}

describe('selectCandidatePool', () => {
  it('exact fit: returns exactly the lowest tier when its size equals neededCount', () => {
    const players = [
      player('a', 0),
      player('b', 0),
      player('c', 1),
      player('d', 1),
    ]

    const result = selectCandidatePool(players, 2)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.pool.map((p) => p.id).sort()).toEqual(['a', 'b'])
      expect(result.mandatoryIds).toEqual(new Set())
    }
  })

  it('returns the whole lowest tier even if larger than neededCount (no partial trimming)', () => {
    const players = [player('a', 0), player('b', 0), player('c', 0), player('d', 1)]

    const result = selectCandidatePool(players, 2)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.pool.map((p) => p.id).sort()).toEqual(['a', 'b', 'c'])
      expect(result.mandatoryIds).toEqual(new Set())
    }
  })

  it('tier expansion: pulls in the whole next tier when the lowest tier is too small', () => {
    const players = [
      player('a', 0), // tier 0: 1 player, not enough alone
      player('b', 1),
      player('c', 1),
      player('d', 1), // tier 1: 3 players
      player('e', 2),
    ]

    const result = selectCandidatePool(players, 3)

    expect(result.ok).toBe(true)
    if (result.ok) {
      // whole tier 0 (a) + whole tier 1 (b, c, d) = 4, even though only 3 were needed
      expect(result.pool.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd'])
      // tier 0 (a) was short on its own, so it's mandatory; tier 1 (b, c, d) is the
      // tier that completed the requirement, so it's optional/selectable
      expect(result.mandatoryIds).toEqual(new Set(['a']))
    }
  })

  it('mandatory tier smaller than neededCount by more than one seat', () => {
    const players = [
      player('a', 0), // tier 0: 2 players, short by 2 seats for a 4-needed doubles draw
      player('b', 0),
      player('c', 1),
      player('d', 1),
      player('e', 1),
      player('f', 1),
      player('g', 1), // tier 1: 5 players
    ]

    const result = selectCandidatePool(players, 4)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.pool.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
      expect(result.mandatoryIds).toEqual(new Set(['a', 'b']))
    }
  })

  it('not enough players: returns an explicit failure instead of throwing', () => {
    const players = [player('a', 0), player('b', 0)]

    const result = selectCandidatePool(players, 4)

    expect(result).toEqual({ ok: false, reason: 'not_enough_players' })
  })

  it('not enough players: exactly one short still fails explicitly', () => {
    const players = [player('a', 0), player('b', 1), player('c', 2)]

    const result = selectCandidatePool(players, 4)

    expect(result.ok).toBe(false)
  })
})
