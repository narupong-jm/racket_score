import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickDoublesQuartet } from './pickDoublesQuartet'
import { canonicalPairKey } from './pairKey'
import type { CandidatePlayer, PairingHistory } from './types'

function player(
  id: string,
  skillValue: number,
  gender: 'male' | 'female',
): CandidatePlayer {
  return { id, gender, skillValue, matchesPlayedInTournament: 0 }
}

function emptyHistory(): PairingHistory {
  return { opponentPairs: new Set(), teammatePairs: new Set() }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pickDoublesQuartet', () => {
  it('chooses the quartet with the smallest skill spread', () => {
    const pool = [
      player('a', 50, 'male'),
      player('b', 51, 'male'),
      player('c', 52, 'female'),
      player('d', 53, 'female'),
      player('e', 10, 'male'), // extreme outlier
      player('f', 95, 'female'), // extreme outlier
    ]

    const quartet = pickDoublesQuartet(pool, new Set(), emptyHistory())

    expect(quartet?.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('tiebreaks toward an even 2-2 gender split among equally-tied skill spreads', () => {
    const pool = [
      player('m1', 50, 'male'),
      player('m2', 50, 'male'),
      player('m3', 50, 'male'),
      player('f1', 50, 'female'),
      player('f2', 50, 'female'),
      player('f3', 50, 'female'),
    ]
    // all C(6,4)=15 quartets are tied on skill spread (0) -> gender tier decides

    const quartet = pickDoublesQuartet(pool, new Set(), emptyHistory())

    expect(quartet).not.toBeNull()
    const maleCount = quartet?.filter((p) => p.gender === 'male').length
    expect(maleCount).toBe(2)
  })

  it('picks the most gender-balanced quartet even when it has a much larger skill spread (gender wins)', () => {
    const pool = [
      player('a', 50, 'male'),
      player('b', 51, 'male'),
      player('c', 52, 'male'),
      player('d', 53, 'male'), // {a,b,c,d}: spread 3, all-male (imbalance 4)
      player('e', 10, 'female'), // any 2-2 quartet needs both e and f, but they're extreme outliers
      player('f', 95, 'female'),
    ]

    const quartet = pickDoublesQuartet(pool, new Set(), emptyHistory())

    // Gender balance is a hard filter now: any 2-2 quartet (which must include both
    // e and f, the only two females) is preferred over the tighter-skill all-male
    // {a,b,c,d}, even though it has a much larger skill spread (85 vs 3).
    expect(quartet?.some((p) => p.id === 'e')).toBe(true)
    expect(quartet?.some((p) => p.id === 'f')).toBe(true)
  })

  it('picks randomly among fully tied quartets, honoring the whole tied set', () => {
    const pool = [
      player('a', 50, 'male'),
      player('b', 50, 'male'),
      player('c', 50, 'male'),
      player('d', 50, 'male'),
      player('e', 50, 'male'),
    ]
    // all 5 quartets tied: skill spread 0, gender imbalance 4 (all-male)

    vi.spyOn(Math, 'random').mockReturnValue(0)
    const first = pickDoublesQuartet(pool, new Set(), emptyHistory())

    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const last = pickDoublesQuartet(pool, new Set(), emptyHistory())

    expect(first).not.toBeNull()
    expect(last).not.toBeNull()
    expect(first?.map((p) => p.id).sort()).not.toEqual(
      last?.map((p) => p.id).sort(),
    )
  })

  it('returns null instead of throwing when there are fewer than 4 players', () => {
    const pool = [player('a', 50, 'male'), player('b', 50, 'female')]

    expect(pickDoublesQuartet(pool, new Set(), emptyHistory())).toBeNull()
  })

  it('only considers quartets containing every mandatory player', () => {
    const pool = [
      player('a', 50, 'male'),
      player('b', 51, 'male'),
      player('c', 52, 'female'),
      player('d', 53, 'female'),
      player('e', 10, 'male'), // mandatory, despite being a skill outlier
    ]
    // Without a mandatory constraint, {a,b,c,d} (spread 3) beats any quartet with e.

    const quartet = pickDoublesQuartet(pool, new Set(['e']), emptyHistory())

    expect(quartet).not.toBeNull()
    expect(quartet?.some((p) => p.id === 'e')).toBe(true)
  })

  it('prefers a quartet with fewer repeat pairings among its members over one with more, all else equal', () => {
    const pool = [
      player('a', 50, 'male'),
      player('b', 50, 'male'),
      player('c', 50, 'female'),
      player('d', 50, 'female'),
      player('e', 50, 'male'),
      player('f', 50, 'female'),
    ]
    // All C(6,4)=15 quartets with 2 males and 2 females tie on gender imbalance (0)
    // and skill spread (0). {a,c,e,f} and {b,d,e,f} are both 2-2 quartets; mark 'a'
    // and 'c' as having played together before -> any quartet containing both should
    // be disfavored relative to one that doesn't.
    const history: PairingHistory = {
      opponentPairs: new Set([canonicalPairKey('a', 'c')]),
      teammatePairs: new Set(),
    }

    const quartet = pickDoublesQuartet(pool, new Set(), history)

    expect(quartet).not.toBeNull()
    const ids = quartet!.map((p) => p.id)
    expect(ids.includes('a') && ids.includes('c')).toBe(false)
  })

  it('falls back to a repeat-containing quartet when every remaining option has one', () => {
    const pool = [
      player('a', 50, 'male'),
      player('b', 50, 'male'),
      player('c', 50, 'female'),
      player('d', 50, 'female'),
    ]
    // Only one possible 2-2 quartet exists ({a,b,c,d}) -> it must be returned even
    // though every pair in it has already faced off before.
    const history: PairingHistory = {
      opponentPairs: new Set([
        canonicalPairKey('a', 'c'),
        canonicalPairKey('a', 'd'),
        canonicalPairKey('b', 'c'),
        canonicalPairKey('b', 'd'),
      ]),
      teammatePairs: new Set([
        canonicalPairKey('a', 'b'),
        canonicalPairKey('c', 'd'),
      ]),
    }

    const quartet = pickDoublesQuartet(pool, new Set(), history)

    expect(quartet).not.toBeNull()
    expect(quartet?.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})
