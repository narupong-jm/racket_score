import { describe, expect, it } from 'vitest'
import { generateNextMatch } from './generateNextMatch'
import { canonicalPairKey } from './pairKey'
import type { CandidatePlayer, PairingHistory } from './types'

function player(
  id: string,
  skillValue: number,
  gender: 'male' | 'female' = 'male',
  matchesPlayedInTournament = 0,
): CandidatePlayer {
  return { id, gender, skillValue, matchesPlayedInTournament }
}

function emptyHistory(): PairingHistory {
  return { opponentPairs: new Set(), teammatePairs: new Set() }
}

function teamIds(
  result: ReturnType<typeof generateNextMatch>,
  team: 1 | 2,
): string[] {
  if (!result.ok) return []
  return result.participants
    .filter((p) => p.team === team)
    .map((p) => p.playerId)
}

describe('generateNextMatch', () => {
  describe('singles', () => {
    it('fresh tournament first draw: everyone at 0 matches produces a valid 1v1', () => {
      const players = [
        player('a', 50),
        player('b', 51),
        player('c', 49),
        player('d', 52),
      ]

      const result = generateNextMatch('singles', players, emptyHistory())

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.participants).toHaveLength(2)
      expect(teamIds(result, 1)).toHaveLength(1)
      expect(teamIds(result, 2)).toHaveLength(1)
      const drawnIds = result.participants.map((p) => p.playerId)
      drawnIds.forEach((id) => expect(['a', 'b', 'c', 'd']).toContain(id))
    })

    it('uneven match counts: draws only from the lowest-match-count tier', () => {
      const players = [
        player('a', 50, 'male', 0),
        player('b', 50, 'male', 0),
        player('c', 50, 'male', 5),
        player('d', 50, 'male', 5),
      ]

      const result = generateNextMatch('singles', players, emptyHistory())

      expect(result.ok).toBe(true)
      if (!result.ok) return
      const drawnIds = result.participants.map((p) => p.playerId).sort()
      expect(drawnIds).toEqual(['a', 'b']) // the 5-match players must not be drawn
    })

    it('newly-added player is surfaced by tier expansion and drawn when it best balances skill', () => {
      // "newPlayer" just joined (0 matches); everyone else already has 2 matches.
      // Tier 0 alone (just newPlayer) is too small, so it expands to include tier 1
      // in full. newPlayer's skill is closest to existing1, so that's the unique
      // minimal-skill-gap pair once the pool is assembled.
      const players = [
        player('newPlayer', 50, 'male', 0),
        player('existing1', 52, 'male', 2),
        player('existing2', 10, 'male', 2),
        player('existing3', 90, 'male', 2),
      ]

      const result = generateNextMatch('singles', players, emptyHistory())

      expect(result.ok).toBe(true)
      if (!result.ok) return
      const drawnIds = result.participants.map((p) => p.playerId).sort()
      expect(drawnIds).toEqual(['existing1', 'newPlayer'])
    })

    it('forced repeat: still returns a match when the only possible pair already played', () => {
      const players = [player('a', 50), player('b', 50)]
      const history: PairingHistory = {
        opponentPairs: new Set([canonicalPairKey('a', 'b')]),
        teammatePairs: new Set(),
      }

      const result = generateNextMatch('singles', players, history)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.participants.map((p) => p.playerId).sort()).toEqual([
        'a',
        'b',
      ])
    })

    it('not enough players: returns an explicit error instead of throwing', () => {
      const players = [player('a', 50)]

      const result = generateNextMatch('singles', players, emptyHistory())

      expect(result).toEqual({ ok: false, error: 'not_enough_players' })
    })
  })

  describe('doubles', () => {
    it('fresh tournament first draw: everyone at 0 matches produces a valid 2v2', () => {
      const players = [
        player('a', 50),
        player('b', 51),
        player('c', 49),
        player('d', 52),
      ]

      const result = generateNextMatch('doubles', players, emptyHistory())

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.participants).toHaveLength(4)
      expect(teamIds(result, 1)).toHaveLength(2)
      expect(teamIds(result, 2)).toHaveLength(2)
    })

    it('skewed gender ratio (5 male / 1 female): includes the lone female over an all-male quartet', () => {
      const players = [
        player('m1', 50, 'male'),
        player('m2', 50, 'male'),
        player('m3', 50, 'male'),
        player('m4', 50, 'male'),
        player('m5', 50, 'male'),
        player('f1', 50, 'female'),
      ]
      // uniform skill -> every quartet is tied on skill spread (0), so gender
      // balance decides: any quartet including f1 has imbalance 2 (3M1F), beating
      // every all-male quartet's imbalance of 4.

      const result = generateNextMatch('doubles', players, emptyHistory())

      expect(result.ok).toBe(true)
      if (!result.ok) return
      const drawnIds = result.participants.map((p) => p.playerId)
      expect(drawnIds).toContain('f1')
      expect(drawnIds).toHaveLength(4)
      expect(teamIds(result, 1)).toHaveLength(2)
      expect(teamIds(result, 2)).toHaveLength(2)
    })

    it('forced repeat: still returns a match when the only possible split already played', () => {
      const players = [
        player('a', 50, 'male'),
        player('b', 50, 'female'),
        player('c', 50, 'male'),
        player('d', 50, 'female'),
      ]
      // mark every possible team pairing as a repeat teammate combo
      const history: PairingHistory = {
        opponentPairs: new Set(),
        teammatePairs: new Set([
          canonicalPairKey('a', 'b'),
          canonicalPairKey('c', 'd'),
          canonicalPairKey('a', 'c'),
          canonicalPairKey('b', 'd'),
          canonicalPairKey('a', 'd'),
          canonicalPairKey('b', 'c'),
        ]),
      }

      const result = generateNextMatch('doubles', players, history)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.participants).toHaveLength(4)
    })

    it('not enough players: returns an explicit error instead of throwing', () => {
      const players = [player('a', 50), player('b', 50), player('c', 50)]

      const result = generateNextMatch('doubles', players, emptyHistory())

      expect(result).toEqual({ ok: false, error: 'not_enough_players' })
    })
  })
})
