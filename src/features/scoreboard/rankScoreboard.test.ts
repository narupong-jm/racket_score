import { describe, expect, it } from 'vitest'
import { rankScoreboard, type RankableEntry } from './rankScoreboard'

function entry(
  playerId: string,
  winRate: number | null,
  totalPoints: number,
): RankableEntry {
  return { playerId, winRate, totalPoints }
}

describe('rankScoreboard', () => {
  it('sorts by win rate descending', () => {
    const result = rankScoreboard([entry('a', 0.25, 0), entry('b', 0.75, 0)])
    expect(result.map((r) => r.playerId)).toEqual(['b', 'a'])
  })

  it('treats a null win rate (no matches played) as lower than a real 0%', () => {
    const result = rankScoreboard([entry('a', null, 0), entry('b', 0, 0)])
    expect(result.map((r) => r.playerId)).toEqual(['b', 'a'])
  })

  it('breaks a win-rate tie by total points scored, descending', () => {
    const result = rankScoreboard([entry('a', 0.5, 10), entry('b', 0.5, 20)])
    expect(result.map((r) => r.playerId)).toEqual(['b', 'a'])
  })

  it('gives fully-tied entries the same rank and uses standard competition ranking for the next distinct entry (1, 1, 3)', () => {
    const result = rankScoreboard([
      entry('a', 0.5, 10),
      entry('b', 0.5, 10),
      entry('c', 0.4, 10),
    ])
    expect(result.map((r) => [r.playerId, r.rank])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ])
  })

  it('is deterministic regardless of input order when fully tied, via a player-id tiebreak that does not affect rank', () => {
    const p1 = entry('p1', 0.5, 10)
    const p2 = entry('p2', 0.5, 10)
    const orderOne = rankScoreboard([p1, p2])
    const orderTwo = rankScoreboard([p2, p1])
    expect(orderOne.map((r) => r.playerId)).toEqual(['p1', 'p2'])
    expect(orderTwo.map((r) => r.playerId)).toEqual(['p1', 'p2'])
    expect(orderOne.map((r) => r.rank)).toEqual([1, 1])
  })

  it('does not mutate the input array', () => {
    const input = [entry('b', 0.2, 0), entry('a', 0.8, 0)]
    rankScoreboard(input)
    expect(input.map((r) => r.playerId)).toEqual(['b', 'a'])
  })
})
