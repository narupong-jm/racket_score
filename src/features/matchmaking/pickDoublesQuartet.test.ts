import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickDoublesQuartet } from './pickDoublesQuartet'
import type { CandidatePlayer } from './types'

function player(id: string, skillValue: number, gender: 'male' | 'female'): CandidatePlayer {
  return { id, gender, skillValue, matchesPlayedInTournament: 0 }
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

    const quartet = pickDoublesQuartet(pool)

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

    const quartet = pickDoublesQuartet(pool)

    expect(quartet).not.toBeNull()
    const maleCount = quartet?.filter((p) => p.gender === 'male').length
    expect(maleCount).toBe(2)
  })

  it('picks the skill-best quartet even when it has worse gender balance (skill wins)', () => {
    const pool = [
      player('a', 50, 'male'),
      player('b', 51, 'male'),
      player('c', 52, 'male'),
      player('d', 53, 'male'), // {a,b,c,d}: spread 3, all-male (imbalance 4)
      player('e', 10, 'female'), // any 2-2 quartet needs both e and f, but they're extreme outliers
      player('f', 95, 'female'),
    ]

    const quartet = pickDoublesQuartet(pool)

    // The only way to get a 2-2 split is {e,f,+2 of a-d}, which has a much larger
    // skill spread (>= 85) than the all-male {a,b,c,d} (spread 3). Skill outranks gender.
    expect(quartet?.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd'])
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
    const first = pickDoublesQuartet(pool)

    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const last = pickDoublesQuartet(pool)

    expect(first).not.toBeNull()
    expect(last).not.toBeNull()
    expect(first?.map((p) => p.id).sort()).not.toEqual(last?.map((p) => p.id).sort())
  })

  it('returns null instead of throwing when there are fewer than 4 players', () => {
    const pool = [player('a', 50, 'male'), player('b', 50, 'female')]

    expect(pickDoublesQuartet(pool)).toBeNull()
  })
})
