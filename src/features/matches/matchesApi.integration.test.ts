import { afterAll, describe, expect, it } from 'vitest'
import { createMatch, getMatchHistory, recordMatchResult } from './matchesApi'
import { createTournament, addParticipant } from '../tournaments/tournamentsApi'
import { createPlayer } from '../players/playersApi'
import { supabase } from '../../lib/supabaseClient'

describe('matchesApi (real project, anon key)', () => {
  const runId = crypto.randomUUID()
  let tournamentId: string | undefined
  const playerIds: string[] = []
  let matchId: string | undefined

  afterAll(async () => {
    if (tournamentId) {
      await supabase.from('match_games').delete().in('match_id', matchId ? [matchId] : [])
      await supabase.from('match_participants').delete().in('match_id', matchId ? [matchId] : [])
      await supabase.from('matches').delete().eq('tournament_id', tournamentId)
      await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId)
      await supabase.from('tournaments').delete().eq('id', tournamentId)
    }
    if (playerIds.length > 0) {
      await supabase.from('players').delete().in('id', playerIds)
    }
  })

  it('seeds 4 players in a doubles tournament', async () => {
    const tournament = await createTournament({
      name: `Matches API Test ${runId}`,
      type: 'doubles',
      games_per_match: 3,
      points_per_game: 21,
    })
    tournamentId = tournament.id

    for (const label of ['A', 'B', 'C', 'D']) {
      const player = await createPlayer({
        name: `Matches API Test ${label} ${runId}`,
        gender: label === 'A' || label === 'C' ? 'male' : 'female',
        self_selected_level: 'beginner',
      })
      playerIds.push(player.id)
      await addParticipant(tournamentId, player.id)
    }
  })

  it('creates a doubles match via the atomic RPC', async () => {
    if (!tournamentId) throw new Error('tournamentId not set')
    const [a, b, c, d] = playerIds

    const match = await createMatch(tournamentId, 1, [
      { player_id: a, team: 1 },
      { player_id: b, team: 1 },
      { player_id: c, team: 2 },
      { player_id: d, team: 2 },
    ])
    matchId = match.id
    expect(match.status).toBe('queued')

    // getMatchHistory only reflects completed matches -- a queued (unplayed) match
    // must not count as a pairing/repeat yet.
    const history = await getMatchHistory(tournamentId)
    expect(history).toHaveLength(0)
  })

  it('rolls back the whole match on a partial failure (no orphan matches row)', async () => {
    if (!tournamentId) throw new Error('tournamentId not set')
    const [a, b, c] = playerIds
    const bogusPlayerId = '00000000-0000-0000-0000-000000000000'

    const { count: beforeCount } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    await expect(
      createMatch(tournamentId, 2, [
        { player_id: a, team: 1 },
        { player_id: b, team: 1 },
        { player_id: c, team: 2 },
        { player_id: bogusPlayerId, team: 2 }, // violates FK -> whole call must fail
      ]),
    ).rejects.toThrow()

    const { count: afterCount } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    expect(afterCount).toBe(beforeCount) // no orphan `matches` row left behind
  })

  it('records a match result and reflects it in match history', async () => {
    if (!tournamentId || !matchId) throw new Error('setup not complete')

    const result = await recordMatchResult(matchId, [
      { game_number: 1, team1_score: 21, team2_score: 15 },
      { game_number: 2, team1_score: 21, team2_score: 18 },
    ])
    expect(result.status).toBe('completed')

    // now that the match is completed, it must show up in match history
    const history = await getMatchHistory(tournamentId)
    expect(history).toHaveLength(4)
    expect(history.filter((h) => h.match_id === matchId && h.team === 1)).toHaveLength(2)
  })
})
