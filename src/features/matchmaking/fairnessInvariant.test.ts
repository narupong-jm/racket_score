import { describe, expect, it } from 'vitest'
import { generateNextMatch } from './generateNextMatch'
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
