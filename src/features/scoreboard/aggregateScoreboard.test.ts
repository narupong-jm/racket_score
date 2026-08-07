import { describe, expect, it } from 'vitest'
import { aggregateScoreboard } from './aggregateScoreboard'
import type { Player } from '../players/playersApi'
import type { PlayerMatchHistoryRow } from './scoreboardApi'

function makePlayer(id: string, name: string): Player {
  return {
    id,
    name,
    gender: 'male',
    self_selected_level: 'beginner',
    created_at: '2026-01-01T00:00:00Z',
  }
}

function makeRow(
  overrides: Partial<PlayerMatchHistoryRow>,
): PlayerMatchHistoryRow {
  return {
    player_id: 'p1',
    match_id: 'm1',
    tournament_id: 't1',
    tournament_type: 'singles',
    completed_at: '2026-01-05T00:00:00Z',
    won: true,
    points_for: 21,
    ...overrides,
  }
}

describe('aggregateScoreboard', () => {
  it('groups and sums matches/points per player', () => {
    const players = [makePlayer('p1', 'Alice'), makePlayer('p2', 'Bob')]
    const rows: PlayerMatchHistoryRow[] = [
      makeRow({ player_id: 'p1', match_id: 'm1', won: true, points_for: 21 }),
      makeRow({ player_id: 'p1', match_id: 'm2', won: false, points_for: 15 }),
      makeRow({ player_id: 'p1', match_id: 'm3', won: true, points_for: 19 }),
      makeRow({ player_id: 'p2', match_id: 'm1', won: false, points_for: 10 }),
    ]

    const result = aggregateScoreboard(rows, players)

    expect(result).toEqual([
      {
        player_id: 'p1',
        name: 'Alice',
        matches_played: 3,
        matches_won: 2,
        total_points: 55,
        win_rate: 2 / 3,
      },
      {
        player_id: 'p2',
        name: 'Bob',
        matches_played: 1,
        matches_won: 0,
        total_points: 10,
        win_rate: 0,
      },
    ])
  })

  it('zeroes out a player with no matches in the filtered set, with a null win_rate', () => {
    const players = [makePlayer('p1', 'Alice'), makePlayer('p2', 'Bob')]
    const rows: PlayerMatchHistoryRow[] = [
      makeRow({ player_id: 'p1', match_id: 'm1', won: true, points_for: 21 }),
    ]

    const result = aggregateScoreboard(rows, players)

    expect(result.find((entry) => entry.player_id === 'p2')).toEqual({
      player_id: 'p2',
      name: 'Bob',
      matches_played: 0,
      matches_won: 0,
      total_points: 0,
      win_rate: null,
    })
  })

  it('computes win_rate as matches_won / matches_played', () => {
    const players = [makePlayer('p1', 'Alice')]
    const rows: PlayerMatchHistoryRow[] = [
      makeRow({ player_id: 'p1', match_id: 'm1', won: true }),
      makeRow({ player_id: 'p1', match_id: 'm2', won: true }),
      makeRow({ player_id: 'p1', match_id: 'm3', won: false }),
      makeRow({ player_id: 'p1', match_id: 'm4', won: false }),
    ]

    const [entry] = aggregateScoreboard(rows, players)

    expect(entry.matches_played).toBe(4)
    expect(entry.matches_won).toBe(2)
    expect(entry.win_rate).toBe(0.5)
  })
})
