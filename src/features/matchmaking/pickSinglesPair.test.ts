import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickSinglesPair } from './pickSinglesPair'
import { selectCandidatePool } from './selectCandidatePool'
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pickSinglesPair', () => {
  it('chooses the pair with the smallest skill gap', () => {
    const pool = [
      player('a', 50),
      player('b', 52), // gap 2 with a -> best
      player('c', 90),
    ]

    const pair = pickSinglesPair(pool, emptyHistory())

    expect(pair?.map((p) => p.id).sort()).toEqual(['a', 'b'])
  })

  it('tiebreaks toward a same-gender pairing over a mixed one at equal skill gap', () => {
    // a-b: |50-50|=0 (mixed). a-c: |50-50|=0 (same-gender, male).
    const pool = [player('a', 50, 'female'), player('b', 50, 'male'), player('c', 50, 'female')]

    const pair = pickSinglesPair(pool, emptyHistory())

    expect(pair?.map((p) => p.id).sort()).toEqual(['a', 'c'])
  })

  it('prefers a non-repeat opponent over a repeat at equal skill gap and gender tier', () => {
    // a-b, a-c, b-c are all same-gender with skill gap 0. a-b and b-c have already
    // played, leaving a-c as the only non-repeat option.
    const pool = [player('a', 50), player('b', 50), player('c', 50)]
    const history: PairingHistory = {
      opponentPairs: new Set([canonicalPairKey('a', 'b'), canonicalPairKey('b', 'c')]),
      teammatePairs: new Set(),
    }

    const pair = pickSinglesPair(pool, history)

    expect(pair?.map((p) => p.id).sort()).toEqual(['a', 'c'])
  })

  it('falls back to a repeat pairing when every remaining option is a repeat', () => {
    const pool = [player('a', 50), player('b', 50)]
    const history: PairingHistory = {
      opponentPairs: new Set([canonicalPairKey('a', 'b')]),
      teammatePairs: new Set(),
    }

    const pair = pickSinglesPair(pool, history)

    expect(pair?.map((p) => p.id).sort()).toEqual(['a', 'b'])
  })

  it('picks randomly among fully tied candidates, honoring the whole tied set', () => {
    const pool = [player('a', 50), player('b', 50), player('c', 50), player('d', 50)]
    // All 6 pairs are tied: equal skill gap (0), all same-gender, none are repeats.

    vi.spyOn(Math, 'random').mockReturnValue(0)
    const first = pickSinglesPair(pool, emptyHistory())

    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const last = pickSinglesPair(pool, emptyHistory())

    expect(first).not.toBeNull()
    expect(last).not.toBeNull()
    expect(first?.map((p) => p.id)).not.toEqual(last?.map((p) => p.id))
  })

  it('never returns a player outside the equal-match-count pool selected upstream', () => {
    const allPlayers = [
      player('a', 40, 'male', 0), // tier 0, alone -> not enough, expands to tier 1
      player('b', 60, 'male', 1),
      player('c', 45, 'female', 1),
      player('d', 90, 'male', 2), // higher tier, must be excluded
    ]

    const poolResult = selectCandidatePool(allPlayers, 2)
    expect(poolResult.ok).toBe(true)
    if (!poolResult.ok) return

    const poolIds = new Set(poolResult.pool.map((p) => p.id))
    expect(poolIds).toEqual(new Set(['a', 'b', 'c'])) // tier 0 (a) + whole tier 1 (b, c)

    const pair = pickSinglesPair(poolResult.pool, emptyHistory())

    expect(pair).not.toBeNull()
    pair?.forEach((p) => expect(poolIds.has(p.id)).toBe(true))
    expect(pair?.some((p) => p.id === 'd')).toBe(false)
  })
})
