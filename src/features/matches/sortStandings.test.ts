import { describe, expect, it } from 'vitest'
import { sortStandings } from './sortStandings'
import type { TournamentStanding } from './matchesApi'

function standing(
  player_id: string,
  games_won: number,
  point_diff: number,
): TournamentStanding {
  return {
    tournament_id: 't1',
    player_id,
    name: player_id,
    matches_played: 1,
    games_won,
    games_played: 1,
    point_diff,
  }
}

describe('sortStandings', () => {
  it('sorts by games won descending', () => {
    const result = sortStandings([standing('a', 1, 0), standing('b', 3, 0)])
    expect(result.map((s) => s.player_id)).toEqual(['b', 'a'])
  })

  it('breaks a games-won tie by point differential descending', () => {
    const result = sortStandings([standing('a', 2, -5), standing('b', 2, 10)])
    expect(result.map((s) => s.player_id)).toEqual(['b', 'a'])
  })

  it('gives a fully-tied pair a fixed, deterministic order regardless of input order', () => {
    const p1 = standing('player-b', 2, 5)
    const p2 = standing('player-a', 2, 5)

    const orderOne = sortStandings([p1, p2])
    const orderTwo = sortStandings([p2, p1])

    expect(orderOne.map((s) => s.player_id)).toEqual(['player-a', 'player-b'])
    expect(orderTwo.map((s) => s.player_id)).toEqual(['player-a', 'player-b'])
  })

  it('does not mutate the input array', () => {
    const input = [standing('a', 1, 0), standing('b', 3, 0)]
    const original = [...input]
    sortStandings(input)
    expect(input).toEqual(original)
  })
})
