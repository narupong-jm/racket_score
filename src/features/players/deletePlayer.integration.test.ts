import { afterAll, describe, expect, it } from 'vitest'
import { createPlayer, deletePlayer, listPlayers } from './playersApi'
import { createTournament, addParticipant } from '../tournaments/tournamentsApi'
import { createMatch } from '../matches/matchesApi'
import { supabase } from '../../lib/supabaseClient'
import { testWritePassphrase } from '../../test/testPassphrase'

describe('deletePlayer (real project, anon key)', () => {
  const runId = crypto.randomUUID()
  let tournamentId: string | undefined

  afterAll(async () => {
    if (tournamentId) {
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId)
      const matchIds = (matches ?? []).map((m) => m.id)
      if (matchIds.length > 0) {
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
    // The player fixture created for the "has matches" case is left blocked
    // from deletion by design -- it can't be cleaned up via deletePlayer, and
    // `anon` has no direct DELETE privilege on `players` (Phase 16), matching
    // the same known gap already present in this file's sibling integration
    // tests' cleanup.
  })

  it('deletes a player with zero match history', async () => {
    const player = await createPlayer(
      {
        name: `Delete Test No History ${runId}`,
        gender: 'male',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )

    await deletePlayer(player.id, testWritePassphrase)

    const players = await listPlayers()
    expect(players.some((p) => p.id === player.id)).toBe(false)
  })

  it('rejects deleting a player who has a match_participants row', async () => {
    const playerA = await createPlayer(
      {
        name: `Delete Test Has Match A ${runId}`,
        gender: 'male',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    const playerB = await createPlayer(
      {
        name: `Delete Test Has Match B ${runId}`,
        gender: 'female',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )

    const tournament = await createTournament(
      {
        name: `Delete Test ${runId}`,
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
    await createMatch(
      tournamentId,
      1,
      [
        { player_id: playerA.id, team: 1 },
        { player_id: playerB.id, team: 2 },
      ],
      testWritePassphrase,
    )

    await expect(
      deletePlayer(playerA.id, testWritePassphrase),
    ).rejects.toThrow()

    const players = await listPlayers()
    expect(players.some((p) => p.id === playerA.id)).toBe(true)
  })
})
