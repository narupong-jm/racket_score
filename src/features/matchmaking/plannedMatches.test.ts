import { describe, expect, it } from 'vitest'
import {
  applyPlannedMatches,
  drawMatches,
  findReusedPlayerIds,
  type PlannedMatch,
} from './plannedMatches'
import { canonicalPairKey } from './pairKey'
import type { CandidatePlayer, PairingHistory } from './types'

function emptyHistory(): PairingHistory {
  return { opponentPairs: new Set(), teammatePairs: new Set() }
}

function makePlayers(n: number, played = 0): CandidatePlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    gender: i % 2 === 0 ? 'male' : 'female',
    skillValue: 40 + i * 3,
    matchesPlayedInTournament: played,
  }))
}

const singles = (a: string, b: string): PlannedMatch => [
  { playerId: a, team: 1 },
  { playerId: b, team: 2 },
]
const doubles = (a: string, b: string, c: string, d: string): PlannedMatch => [
  { playerId: a, team: 1 },
  { playerId: b, team: 1 },
  { playerId: c, team: 2 },
  { playerId: d, team: 2 },
]

describe('applyPlannedMatches', () => {
  it('adds 1 per appearance, accumulating, and leaves others unchanged', () => {
    const players = makePlayers(4, 2)
    const { candidates } = applyPlannedMatches(players, emptyHistory(), [
      singles('p0', 'p1'),
      singles('p0', 'p2'),
    ])
    const count = (id: string) =>
      candidates.find((p) => p.id === id)!.matchesPlayedInTournament
    expect(count('p0')).toBe(4)
    expect(count('p1')).toBe(3)
    expect(count('p2')).toBe(3)
    expect(count('p3')).toBe(2)
  })

  it('adds opponent pair only for singles', () => {
    const { pairingHistory } = applyPlannedMatches(
      makePlayers(2),
      emptyHistory(),
      [singles('p0', 'p1')],
    )
    expect([...pairingHistory.opponentPairs]).toEqual([
      canonicalPairKey('p0', 'p1'),
    ])
    expect(pairingHistory.teammatePairs.size).toBe(0)
  })

  it('adds teammates and all cross-team opponent pairs for doubles', () => {
    const { pairingHistory } = applyPlannedMatches(
      makePlayers(4),
      emptyHistory(),
      [doubles('p0', 'p1', 'p2', 'p3')],
    )
    expect(pairingHistory.teammatePairs).toEqual(
      new Set([canonicalPairKey('p0', 'p1'), canonicalPairKey('p2', 'p3')]),
    )
    expect(pairingHistory.opponentPairs).toEqual(
      new Set([
        canonicalPairKey('p0', 'p2'),
        canonicalPairKey('p0', 'p3'),
        canonicalPairKey('p1', 'p2'),
        canonicalPairKey('p1', 'p3'),
      ]),
    )
  })

  it('does not mutate inputs and keeps existing history', () => {
    const players = makePlayers(2)
    const history = emptyHistory()
    history.opponentPairs.add('x|y')
    const out = applyPlannedMatches(players, history, [singles('p0', 'p1')])
    expect(players[0].matchesPlayedInTournament).toBe(0)
    expect(history.opponentPairs.size).toBe(1)
    expect(out.candidates).not.toBe(players)
    expect(out.pairingHistory.opponentPairs.has('x|y')).toBe(true)
    expect(out.pairingHistory.opponentPairs.size).toBe(2)
  })

  it('returns equal data for an empty planned list', () => {
    const players = makePlayers(3, 1)
    const history = emptyHistory()
    history.teammatePairs.add('a|b')
    const out = applyPlannedMatches(players, history, [])
    expect(out.candidates).toEqual(players)
    expect(out.pairingHistory).toEqual(history)
    expect(out.pairingHistory.teammatePairs).not.toBe(history.teammatePairs)
  })
})

describe('findReusedPlayerIds', () => {
  it('returns none when no overlap', () => {
    expect(findReusedPlayerIds(singles('a', 'b'), [singles('c', 'd')])).toEqual(
      [],
    )
  })

  it('returns overlapping ids in order of first appearance in drawn, unique', () => {
    const drawn = doubles('a', 'b', 'c', 'd')
    const planned = [singles('d', 'x'), singles('b', 'd'), singles('b', 'y')]
    expect(findReusedPlayerIds(drawn, planned)).toEqual(['b', 'd'])
  })
})

describe('drawMatches', () => {
  it('returns empty for count 0 and negative', () => {
    const empty = { matches: [], reusedPlayerIds: [], stoppedEarly: false }
    expect(
      drawMatches('singles', makePlayers(4), emptyHistory(), [], 0),
    ).toEqual(empty)
    expect(
      drawMatches('singles', makePlayers(4), emptyHistory(), [], -2),
    ).toEqual(empty)
  })

  it('draws one match', () => {
    const r = drawMatches('doubles', makePlayers(4), emptyHistory(), [], 1)
    expect(r.matches).toHaveLength(1)
    expect(r.matches[0]).toHaveLength(4)
    expect(r.stoppedEarly).toBe(false)
    expect(r.reusedPlayerIds).toEqual([])
  })

  it('draws 3 matches with enough players and no reuse; each draw sees earlier ones', () => {
    const r = drawMatches('doubles', makePlayers(12), emptyHistory(), [], 3)
    expect(r.matches).toHaveLength(3)
    const ids = r.matches.flat().map((p) => p.playerId)
    expect(new Set(ids).size).toBe(12)
    expect(r.reusedPlayerIds).toEqual([])
    expect(r.stoppedEarly).toBe(false)
  })

  it('stops early when players run out', () => {
    const r = drawMatches('doubles', makePlayers(3), emptyHistory(), [], 2)
    expect(r.matches).toEqual([])
    expect(r.stoppedEarly).toBe(true)
  })

  it('reports unique reused ids and respects an existing planned list', () => {
    const planned = [doubles('p0', 'p1', 'p2', 'p3')]
    const r = drawMatches('doubles', makePlayers(4), emptyHistory(), planned, 2)
    expect(r.matches).toHaveLength(2)
    expect([...r.reusedPlayerIds].sort()).toEqual(['p0', 'p1', 'p2', 'p3'])
    expect(planned).toHaveLength(1)
  })

  it('prefers players not in the existing planned list', () => {
    const planned = [singles('p0', 'p1')]
    const r = drawMatches('singles', makePlayers(4), emptyHistory(), planned, 1)
    const ids = r.matches[0].map((p) => p.playerId).sort()
    expect(ids).toEqual(['p2', 'p3'])
    expect(r.reusedPlayerIds).toEqual([])
  })

  it('later draws avoid players already drawn in earlier matches', () => {
    const r = drawMatches('singles', makePlayers(4), emptyHistory(), [], 2)
    const all = r.matches.flat().map((p) => p.playerId)
    expect(new Set(all).size).toBe(4)
  })
})
