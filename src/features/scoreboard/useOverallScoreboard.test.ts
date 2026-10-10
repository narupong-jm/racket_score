import { describe, expect, it, vi } from 'vitest'
import { fetchOverallScoreboard } from './useOverallScoreboard'
import * as playersApi from '../players/playersApi'
import * as scoreboardApi from './scoreboardApi'
import type { Player } from '../players/playersApi'
import type { PlayerMatchHistoryRow } from './scoreboardApi'

vi.mock('../players/playersApi', () => ({
  listPlayers: vi.fn(),
}))

vi.mock('./scoreboardApi', () => ({
  listPlayerMatchHistory: vi.fn(),
}))

function makePlayer(
  id: string,
  name: string,
  badminton: Player['badminton_self_selected_level'],
  tennis: Player['tennis_self_selected_level'],
): Player {
  return {
    id,
    name,
    gender: 'male',
    badminton_self_selected_level: badminton,
    tennis_self_selected_level: tennis,
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
    sport: 'badminton',
    completed_at: '2026-01-05T00:00:00Z',
    won: true,
    points_for: 21,
    ...overrides,
  }
}

describe('fetchOverallScoreboard', () => {
  it('omits a tennis-only person from the badminton board', async () => {
    const badmintonMember = makePlayer('p1', 'Alice', 'beginner', null)
    const tennisOnly = makePlayer('p2', 'Bob', null, 'beginner')
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      badmintonMember,
      tennisOnly,
    ])
    vi.mocked(scoreboardApi.listPlayerMatchHistory).mockResolvedValue([])

    const result = await fetchOverallScoreboard('all', 'all', 'badminton')

    expect(result.map((e) => e.player_id)).toEqual(['p1'])
  })

  it('omits a badminton-only person from the tennis board', async () => {
    const badmintonOnly = makePlayer('p1', 'Alice', 'beginner', null)
    const tennisMember = makePlayer('p2', 'Bob', null, 'beginner')
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      badmintonOnly,
      tennisMember,
    ])
    vi.mocked(scoreboardApi.listPlayerMatchHistory).mockResolvedValue([])

    const result = await fetchOverallScoreboard('all', 'all', 'tennis')

    expect(result.map((e) => e.player_id)).toEqual(['p2'])
  })

  it('never filters out a player who has history rows in the result set, even if no longer a member', async () => {
    // p1 was removed from badminton (e.g. via remove_player_from_sport) but
    // still has completed-match history there -- the board must keep them.
    const removedFromBadminton = makePlayer('p1', 'Alice', null, 'beginner')
    const badmintonMember = makePlayer('p2', 'Bob', 'beginner', null)
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      removedFromBadminton,
      badmintonMember,
    ])
    vi.mocked(scoreboardApi.listPlayerMatchHistory).mockResolvedValue([
      makeRow({ player_id: 'p1', match_id: 'm1', sport: 'badminton' }),
    ])

    const result = await fetchOverallScoreboard('all', 'all', 'badminton')

    const alice = result.find((e) => e.player_id === 'p1')
    expect(alice).toBeDefined()
    expect(alice?.matches_played).toBe(1)
    expect(result.map((e) => e.player_id).sort()).toEqual(['p1', 'p2'])
  })
})
