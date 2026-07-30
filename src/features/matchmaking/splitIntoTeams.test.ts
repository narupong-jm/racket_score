import { afterEach, describe, expect, it, vi } from 'vitest'
import { splitIntoTeams, type DoublesTeams } from './splitIntoTeams'
import { canonicalPairKey } from './pairKey'
import type { CandidatePlayer, PairingHistory } from './types'

function player(id: string, skillValue: number, gender: 'male' | 'female'): CandidatePlayer {
  return { id, gender, skillValue, matchesPlayedInTournament: 0 }
}

function emptyHistory(): PairingHistory {
  return { opponentPairs: new Set(), teammatePairs: new Set() }
}

function normalizePartition(teams: DoublesTeams | null): string[][] | null {
  if (!teams) return null
  const [team1, team2] = teams
  const ids1 = team1.map((p) => p.id).sort()
  const ids2 = team2.map((p) => p.id).sort()
  return [ids1, ids2].sort((a, b) => a[0].localeCompare(b[0]))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('splitIntoTeams', () => {
  it('chooses the split with the smallest skill-sum difference', () => {
    const p0 = player('p0', 10, 'male')
    const p1 = player('p1', 90, 'male')
    const p2 = player('p2', 50, 'female')
    const p3 = player('p3', 50, 'female')
    // {p0,p1}v{p2,p3}: 100v100 diff 0 (best). Other two splits: 60v140 diff 80.

    const result = splitIntoTeams([p0, p1, p2, p3], emptyHistory())

    expect(normalizePartition(result)).toEqual(
      normalizePartition([
        [p0, p1],
        [p2, p3],
      ]),
    )
  })

  it('tiebreaks toward gender-mixed teams among equally-balanced skill splits', () => {
    const p0 = player('p0', 50, 'male')
    const p1 = player('p1', 50, 'female')
    const p2 = player('p2', 50, 'male')
    const p3 = player('p3', 50, 'female')
    // all 3 splits tied on skill (diff 0). {p0,p2}v{p1,p3} is the only all-same-gender
    // split (2 non-mixed teams) and must be excluded in favor of a mixed split.

    const result = splitIntoTeams([p0, p1, p2, p3], emptyHistory())

    expect(result).not.toBeNull()
    const [team1, team2] = result!
    expect(team1[0].gender).not.toBe(team1[1].gender)
    expect(team2[0].gender).not.toBe(team2[1].gender)
  })

  it('tiebreaks toward the split with fewer repeat teammate pairings', () => {
    const p0 = player('p0', 50, 'male')
    const p1 = player('p1', 50, 'female')
    const p2 = player('p2', 50, 'male')
    const p3 = player('p3', 50, 'female')
    // {p0,p1}v{p2,p3} and {p0,p3}v{p1,p2} both tied on skill(0) and both fully mixed.
    // Mark {p0,p3} as having played together before -> that split should lose.
    const history: PairingHistory = {
      opponentPairs: new Set(),
      teammatePairs: new Set([canonicalPairKey('p0', 'p3')]),
    }

    const result = splitIntoTeams([p0, p1, p2, p3], history)

    expect(normalizePartition(result)).toEqual(
      normalizePartition([
        [p0, p1],
        [p2, p3],
      ]),
    )
  })

  it('falls back to a repeat split when every remaining option is a repeat', () => {
    const p0 = player('p0', 50, 'male')
    const p1 = player('p1', 50, 'female')
    const p2 = player('p2', 50, 'male')
    const p3 = player('p3', 50, 'female')
    const history: PairingHistory = {
      opponentPairs: new Set(),
      teammatePairs: new Set([canonicalPairKey('p0', 'p1'), canonicalPairKey('p0', 'p3')]),
    }

    const result = splitIntoTeams([p0, p1, p2, p3], history)

    expect(result).not.toBeNull()
  })

  it('picks the skill-best split even when it has worse gender balance (skill wins)', () => {
    const p0 = player('p0', 0, 'male')
    const p1 = player('p1', 100, 'male')
    const p2 = player('p2', 50, 'female')
    const p3 = player('p3', 50, 'female')
    // {p0,p1}v{p2,p3}: diff 0, but both teams same-gender (worst gender score).
    // {p0,p2}v{p1,p3} and {p0,p3}v{p1,p2}: diff 100, but both teams mixed (best gender score).

    const result = splitIntoTeams([p0, p1, p2, p3], emptyHistory())

    expect(normalizePartition(result)).toEqual(
      normalizePartition([
        [p0, p1],
        [p2, p3],
      ]),
    )
  })

  it('picks randomly among fully tied splits, honoring the whole tied set', () => {
    const p0 = player('p0', 50, 'male')
    const p1 = player('p1', 50, 'male')
    const p2 = player('p2', 50, 'male')
    const p3 = player('p3', 50, 'male')
    // all 3 splits tied on skill (0), gender (2 non-mixed each), and repeats (0)

    vi.spyOn(Math, 'random').mockReturnValue(0)
    const first = splitIntoTeams([p0, p1, p2, p3], emptyHistory())

    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const last = splitIntoTeams([p0, p1, p2, p3], emptyHistory())

    expect(normalizePartition(first)).not.toEqual(normalizePartition(last))
  })

  it('returns null instead of throwing for a non-quartet input', () => {
    const pool = [player('p0', 50, 'male'), player('p1', 50, 'female')]

    expect(splitIntoTeams(pool, emptyHistory())).toBeNull()
  })
})
