import { describe, expect, it } from 'vitest'
import { computeMatchImpactPreview } from './matchImpactPreview'
import type { PlayerStats } from './matchImpactPreview'
import type { MatchGame, MatchHistoryEntry } from './matchesApi'

function makeGame(
  matchId: string,
  gameNumber: number,
  team1Score: number,
  team2Score: number,
): MatchGame {
  return {
    match_id: matchId,
    game_number: gameNumber,
    team1_score: team1Score,
    team2_score: team2Score,
  }
}

function makeStats(overrides: Partial<PlayerStats> & { player_id: string }): PlayerStats {
  return {
    player_id: overrides.player_id,
    sport: 'badminton',
    name: null,
    gender: null,
    self_selected_level: null,
    effective_level: null,
    total_matches: 0,
    total_wins: 0,
    win_rate: null,
    ...overrides,
  } as PlayerStats
}

const playerNameById = new Map<string, string>([
  ['p1', 'Alice'],
  ['p2', 'Bob'],
  ['p3', 'Carol'],
  ['p4', 'Dave'],
])

describe('computeMatchImpactPreview', () => {
  it('singles win/loss: winner and loser stats update correctly', () => {
    const participants: MatchHistoryEntry[] = [
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
    ]
    const games = [makeGame('m1', 1, 21, 15), makeGame('m1', 2, 21, 18)]
    const statsByPlayerId = new Map<string, PlayerStats>([
      ['p1', makeStats({ player_id: 'p1', total_matches: 5, total_wins: 4, win_rate: 80 })],
      ['p2', makeStats({ player_id: 'p2', total_matches: 5, total_wins: 1, win_rate: 20 })],
    ])

    const result = computeMatchImpactPreview(
      participants,
      games,
      statsByPlayerId,
      playerNameById,
    )

    const winner = result.find((r) => r.playerId === 'p1')!
    const loser = result.find((r) => r.playerId === 'p2')!

    expect(winner.won).toBe(true)
    expect(winner.beforeMatches).toBe(5)
    expect(winner.beforeWinRate).toBe(80)
    expect(winner.afterMatches).toBe(4)
    // afterWins = 4 - 1 = 3; 3/4 * 100 = 75
    expect(winner.afterWinRate).toBe(75)

    expect(loser.won).toBe(false)
    expect(loser.beforeMatches).toBe(5)
    expect(loser.beforeWinRate).toBe(20)
    expect(loser.afterMatches).toBe(4)
    // afterWins = 1 - 0 = 1; 1/4 * 100 = 25
    expect(loser.afterWinRate).toBe(25)
  })

  it('doubles split: team of two wins, other team of two loses', () => {
    const participants: MatchHistoryEntry[] = [
      { match_id: 'm2', player_id: 'p1', team: 1 },
      { match_id: 'm2', player_id: 'p2', team: 1 },
      { match_id: 'm2', player_id: 'p3', team: 2 },
      { match_id: 'm2', player_id: 'p4', team: 2 },
    ]
    const games = [makeGame('m2', 1, 15, 21), makeGame('m2', 2, 10, 21)]
    const statsByPlayerId = new Map<string, PlayerStats>([
      ['p1', makeStats({ player_id: 'p1', total_matches: 3, total_wins: 1, win_rate: 33.33 })],
      ['p2', makeStats({ player_id: 'p2', total_matches: 2, total_wins: 0, win_rate: 0 })],
      ['p3', makeStats({ player_id: 'p3', total_matches: 4, total_wins: 3, win_rate: 75 })],
      ['p4', makeStats({ player_id: 'p4', total_matches: 1, total_wins: 1, win_rate: 100 })],
    ])

    const result = computeMatchImpactPreview(
      participants,
      games,
      statsByPlayerId,
      playerNameById,
    )

    const byId = new Map(result.map((r) => [r.playerId, r]))

    // Team 1 lost (team2 won both games)
    expect(byId.get('p1')!.won).toBe(false)
    expect(byId.get('p1')!.afterMatches).toBe(2)
    // afterWins = 1 - 0 = 1; 1/2 * 100 = 50
    expect(byId.get('p1')!.afterWinRate).toBe(50)

    expect(byId.get('p2')!.won).toBe(false)
    expect(byId.get('p2')!.afterMatches).toBe(1)
    // afterWins = 0 - 0 = 0; 0/1 * 100 = 0
    expect(byId.get('p2')!.afterWinRate).toBe(0)

    // Team 2 won
    expect(byId.get('p3')!.won).toBe(true)
    expect(byId.get('p3')!.afterMatches).toBe(3)
    // afterWins = 3 - 1 = 2; 2/3 * 100 = 66.666... -> round to 66.67
    expect(byId.get('p3')!.afterWinRate).toBe(66.67)

    expect(byId.get('p4')!.won).toBe(true)
    expect(byId.get('p4')!.afterMatches).toBe(0)
    // afterMatches === 0 -> win rate is null, not divide-by-zero
    expect(byId.get('p4')!.afterWinRate).toBeNull()
  })

  it('handles a player with no prior stats row without throwing', () => {
    const participants: MatchHistoryEntry[] = [
      { match_id: 'm3', player_id: 'p1', team: 1 },
      { match_id: 'm3', player_id: 'p5', team: 2 },
    ]
    const games = [makeGame('m3', 1, 21, 10), makeGame('m3', 2, 21, 12)]
    // p5 has no entry in statsByPlayerId at all.
    const statsByPlayerId = new Map<string, PlayerStats>([
      ['p1', makeStats({ player_id: 'p1', total_matches: 1, total_wins: 1, win_rate: 100 })],
    ])

    const result = computeMatchImpactPreview(
      participants,
      games,
      statsByPlayerId,
      playerNameById,
    )

    const missing = result.find((r) => r.playerId === 'p5')!
    expect(missing.won).toBe(false)
    expect(missing.beforeMatches).toBe(0)
    expect(missing.beforeWinRate).toBeNull()
    // max(0, 0 - 1) = 0
    expect(missing.afterMatches).toBe(0)
    expect(missing.afterWinRate).toBeNull()
    // Falls back to raw id when not present in playerNameById either.
    expect(missing.playerName).toBe('p5')
  })

  it('tied-games match credits no one a win', () => {
    const participants: MatchHistoryEntry[] = [
      { match_id: 'm4', player_id: 'p1', team: 1 },
      { match_id: 'm4', player_id: 'p2', team: 2 },
    ]
    // 1-1 on games won: nobody "won" the match.
    const games = [makeGame('m4', 1, 21, 15), makeGame('m4', 2, 15, 21)]
    const statsByPlayerId = new Map<string, PlayerStats>([
      ['p1', makeStats({ player_id: 'p1', total_matches: 4, total_wins: 2, win_rate: 50 })],
      ['p2', makeStats({ player_id: 'p2', total_matches: 4, total_wins: 2, win_rate: 50 })],
    ])

    const result = computeMatchImpactPreview(
      participants,
      games,
      statsByPlayerId,
      playerNameById,
    )

    for (const entry of result) {
      expect(entry.won).toBe(false)
      expect(entry.afterMatches).toBe(3)
      // afterWins = 2 - 0 = 2; 2/3 * 100 = 66.67
      expect(entry.afterWinRate).toBe(66.67)
    }
  })

  it('an all-tied (0-0 games) match also credits no one a win', () => {
    const participants: MatchHistoryEntry[] = [
      { match_id: 'm5', player_id: 'p1', team: 1 },
      { match_id: 'm5', player_id: 'p2', team: 2 },
    ]
    const games: MatchGame[] = []
    const statsByPlayerId = new Map<string, PlayerStats>([
      ['p1', makeStats({ player_id: 'p1', total_matches: 1, total_wins: 1, win_rate: 100 })],
      ['p2', makeStats({ player_id: 'p2', total_matches: 1, total_wins: 0, win_rate: 0 })],
    ])

    const result = computeMatchImpactPreview(
      participants,
      games,
      statsByPlayerId,
      playerNameById,
    )

    for (const entry of result) {
      expect(entry.won).toBe(false)
    }
  })
})
