import { afterAll, describe, expect, it } from 'vitest'
import { createPlayer, getPlayerStats } from './playersApi'
import { createTournament, addParticipant } from '../tournaments/tournamentsApi'
import { createMatch, recordMatchResult } from '../matches/matchesApi'
import { supabase } from '../../lib/supabaseClient'
import { testWritePassphrase } from '../../test/testPassphrase'

describe('effective_level cutover at exactly 3 matches (real project, anon key)', () => {
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

  it('stays self-selected through 2 matches, then switches to the win-rate band on the 3rd', async () => {
    const player = await createPlayer(
      {
        name: `Cutover Test Player ${runId}`,
        gender: 'male',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    const opponent = await createPlayer(
      {
        name: `Cutover Test Opponent ${runId}`,
        gender: 'female',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    playerIds.push(player.id, opponent.id)

    const tournament = await createTournament(
      {
        name: `Cutover Test ${runId}`,
        type: 'singles',
        games_per_match: 1,
        points_per_game: 21,
      },
      testWritePassphrase,
    )
    tournamentId = tournament.id
    await addParticipant(tournamentId, player.id, testWritePassphrase)
    await addParticipant(tournamentId, opponent.id, testWritePassphrase)

    async function playAndWin(sequenceNumber: number) {
      const match = await createMatch(
        tournamentId!,
        sequenceNumber,
        [
          { player_id: player.id, team: 1 },
          { player_id: opponent.id, team: 2 },
        ],
        testWritePassphrase,
      )
      await recordMatchResult(
        match.id,
        [{ game_number: 1, team1_score: 21, team2_score: 10 }],
        testWritePassphrase,
      )
    }

    await playAndWin(1)
    const statsAfter1 = await getPlayerStats(player.id)
    expect(statsAfter1?.total_matches).toBe(1)
    expect(statsAfter1?.effective_level).toBe('beginner') // still self-selected

    await playAndWin(2)
    const statsAfter2 = await getPlayerStats(player.id)
    expect(statsAfter2?.total_matches).toBe(2)
    expect(statsAfter2?.effective_level).toBe('beginner') // still self-selected below the threshold

    await playAndWin(3)
    const statsAfter3 = await getPlayerStats(player.id)
    expect(statsAfter3?.total_matches).toBe(3)
    expect(statsAfter3?.win_rate).toBe(100)
    expect(statsAfter3?.effective_level).toBe('pro') // switched to the computed win-rate band
  })
})
