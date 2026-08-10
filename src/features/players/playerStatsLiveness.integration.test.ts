import { afterAll, describe, expect, it } from 'vitest'
import { createPlayer, getPlayerStats } from './playersApi'
import { createTournament, addParticipant } from '../tournaments/tournamentsApi'
import { createMatch, recordMatchResult } from '../matches/matchesApi'
import { supabase } from '../../lib/supabaseClient'
import { testWritePassphrase } from '../../test/testPassphrase'

describe('player_stats is view-driven, not a batch job (real project, anon key)', () => {
  const runId = crypto.randomUUID()
  let tournamentId: string | undefined
  const playerIds: string[] = []

  afterAll(async () => {
    if (tournamentId) {
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId)
      const matchIds = (matches ?? []).map((m) => m.id)
      if (matchIds.length > 0) {
        await supabase.from('match_games').delete().in('match_id', matchIds)
        await supabase
          .from('match_participants')
          .delete()
          .in('match_id', matchIds)
      }
      await supabase.from('matches').delete().eq('tournament_id', tournamentId)
      await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournamentId)
      await supabase.from('tournaments').delete().eq('id', tournamentId)
    }
    if (playerIds.length > 0) {
      await supabase.from('players').delete().in('id', playerIds)
    }
  })

  it('reflects a just-recorded result immediately on the very next read, with no lag', async () => {
    const playerA = await createPlayer(
      {
        name: `Liveness Test A ${runId}`,
        gender: 'male',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    const playerB = await createPlayer(
      {
        name: `Liveness Test B ${runId}`,
        gender: 'female',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    playerIds.push(playerA.id, playerB.id)

    const tournament = await createTournament(
      {
        name: `Liveness Test ${runId}`,
        type: 'singles',
        sport: 'badminton',
        games_per_match: 1,
        points_per_game: 21,
      },
      testWritePassphrase,
    )
    tournamentId = tournament.id
    await addParticipant(tournamentId, playerA.id, testWritePassphrase)
    await addParticipant(tournamentId, playerB.id, testWritePassphrase)

    // before any match: both players show 0 matches, self-selected level
    const statsABefore = await getPlayerStats(playerA.id, 'badminton')
    expect(statsABefore?.total_matches).toBe(0)
    expect(statsABefore?.effective_level).toBe('beginner')

    const match = await createMatch(
      tournamentId,
      1,
      [
        { player_id: playerA.id, team: 1 },
        { player_id: playerB.id, team: 2 },
      ],
      testWritePassphrase,
    )
    await recordMatchResult(
      match.id,
      [{ game_number: 1, team1_score: 21, team2_score: 15 }],
      testWritePassphrase,
    )

    // immediately re-query, with no delay/wait/poll in between -- the view must
    // already reflect the just-recorded result on this very next read
    const statsAAfter = await getPlayerStats(playerA.id, 'badminton')
    const statsBAfter = await getPlayerStats(playerB.id, 'badminton')

    expect(statsAAfter?.total_matches).toBe(1)
    expect(statsAAfter?.total_wins).toBe(1)
    expect(statsAAfter?.win_rate).toBe(100)

    expect(statsBAfter?.total_matches).toBe(1)
    expect(statsBAfter?.total_wins).toBe(0)
    expect(statsBAfter?.win_rate).toBe(0)
  })
})
