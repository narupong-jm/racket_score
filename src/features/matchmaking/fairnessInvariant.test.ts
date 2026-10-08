import { describe, expect, it } from 'vitest'
import { generateNextMatch } from './generateNextMatch'
import { applyPlannedMatches, drawMatches } from './plannedMatches'
import type { CandidatePlayer, PairingHistory } from './types'

function emptyHistory(): PairingHistory {
  return { opponentPairs: new Set(), teammatePairs: new Set() }
}

function invariantHolds(players: CandidatePlayer[]): boolean {
  const counts = players.map((p) => p.matchesPlayedInTournament)
  return Math.max(...counts) - Math.min(...counts) <= 1
}

describe('fairness invariant: equal match count (IMPROVEMENT2.md §1.1)', () => {
  it('holds after every match across a multi-round singles session with an odd pool size', () => {
    const players: CandidatePlayer[] = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      gender: i % 2 === 0 ? 'male' : 'female',
      skillValue: 40 + i * 5,
      matchesPlayedInTournament: 0,
    }))

    const history = emptyHistory()

    for (let round = 0; round < 20; round++) {
      const result = generateNextMatch('singles', players, history)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      for (const { playerId } of result.participants) {
        const player = players.find((p) => p.id === playerId)
        if (player) player.matchesPlayedInTournament += 1
      }

      expect(invariantHolds(players)).toBe(true)
    }
  })

  it('holds after every match across a multi-round doubles session with a pool size that never divides evenly by 4', () => {
    const players: CandidatePlayer[] = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`,
      gender: i % 2 === 0 ? 'male' : 'female',
      skillValue: 30 + i * 7,
      matchesPlayedInTournament: 0,
    }))

    const history = emptyHistory()

    for (let round = 0; round < 20; round++) {
      const result = generateNextMatch('doubles', players, history)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      for (const { playerId } of result.participants) {
        const player = players.find((p) => p.id === playerId)
        if (player) player.matchesPlayedInTournament += 1
      }

      expect(invariantHolds(players)).toBe(true)
    }
  })
})

describe('fairness invariant: sequential multi-court draws (planned matches)', () => {
  function makePool(n: number): CandidatePlayer[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      gender: i % 2 === 0 ? 'male' : 'female',
      skillValue: 30 + i * 4,
      matchesPlayedInTournament: 0,
    }))
  }

  it.each([
    ['doubles', 12, 4],
    ['doubles', 7, 3],
    ['singles', 7, 3],
    ['singles', 5, 6],
  ] as const)(
    'keeps the planned-count gap <= 1 after every draw (%s, %i players, queue %i)',
    (type, playerCount, queueSize) => {
      const players = makePool(playerCount)
      const history = emptyHistory()

      for (let n = 1; n <= queueSize; n++) {
        const { matches } = drawMatches(type, players, history, [], n)
        expect(matches).toHaveLength(n)
        const { candidates } = applyPlannedMatches(players, history, matches)
        expect(invariantHolds(candidates)).toBe(true)
      }
    },
  )

  it('draws the lowest-planned players first when some are already in progress', () => {
    const players = makePool(6)
    const inProgress = [
      [
        { playerId: 'p0', team: 1 as const },
        { playerId: 'p1', team: 2 as const },
      ],
    ]

    const { matches, reusedPlayerIds } = drawMatches(
      'singles',
      players,
      emptyHistory(),
      inProgress,
      2,
    )

    const drawn = matches.flat().map((p) => p.playerId)
    expect(drawn).not.toContain('p0')
    expect(drawn).not.toContain('p1')
    expect(new Set(drawn).size).toBe(4)
    expect(reusedPlayerIds).toEqual([])
  })
})
