import { describe, expect, it } from 'vitest'
import { sortScoreboard } from './sortScoreboard'
import type { TournamentStanding } from '../matches/matchesApi'

function standing(
  player_id: string,
  win_rate: number | null,
  point_diff: number,
): TournamentStanding {
  return {
    tournament_id: 't1',
    player_id,
    name: player_id,
    matches_played: win_rate === null ? 0 : 1,
    games_won: 0,
    games_played: 0,
    point_diff,
    matches_won: 0,
    win_rate,
  }
}

describe('sortScoreboard', () => {
  it('sorts by win rate descending', () => {
    const result = sortScoreboard([standing('a', 0.25, 0), standing('b', 0.75, 0)])
    expect(result.map((s) => s.player_id)).toEqual(['b', 'a'])
  })

  it('treats a null win rate as -1, sorting 0-match players last', () => {
    const result = sortScoreboard([standing('a', null, 0), standing('b', 0, 0)])
    expect(result.map((s) => s.player_id)).toEqual(['b', 'a'])
  })

  it('breaks a win-rate tie by point differential descending', () => {
    const result = sortScoreboard([standing('a', 0.5, -5), standing('b', 0.5, 10)])
    expect(result.map((s) => s.player_id)).toEqual(['b', 'a'])
  })

  it('gives a fully-tied pair a fixed, deterministic order regardless of input order', () => {
    const p1 = standing('player-b', 0.5, 5)
    const p2 = standing('player-a', 0.5, 5)

    const orderOne = sortScoreboard([p1, p2])
    const orderTwo = sortScoreboard([p2, p1])

    expect(orderOne.map((s) => s.player_id)).toEqual(['player-a', 'player-b'])
    expect(orderTwo.map((s) => s.player_id)).toEqual(['player-a', 'player-b'])
  })

  it('does not mutate the input array', () => {
    const input = [standing('a', 0.25, 0), standing('b', 0.75, 0)]
    const original = [...input]
    sortScoreboard(input)
    expect(input).toEqual(original)
  })
})
