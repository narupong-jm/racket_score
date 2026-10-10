import { afterAll, describe, expect, it } from 'vitest'
import {
  createPlayer,
  getPlayerStats,
  listPlayers,
  removePlayerFromSport,
  updatePlayer,
} from './playersApi'
import { createTournament, addParticipant } from '../tournaments/tournamentsApi'
import { createMatch } from '../matches/matchesApi'
import { supabase } from '../../lib/supabaseClient'
import { testWritePassphrase } from '../../test/testPassphrase'

describe('removePlayerFromSport (real project, anon key)', () => {
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
    // Every player fixture that still exists after this suite (the
    // both-sports case loses only one sport; the "has matches" and
    // "not_a_member" cases are blocked from removal entirely) is left for
    // the controller's UUID-regex `execute_sql` cleanup pass -- `anon` has
    // no direct DELETE privilege on `players` (Phase 16), the same known gap
    // already present in this file's sibling integration tests' cleanup.
    // Only a person whose LAST sport was removed is actually gone already
    // (the RPC itself deletes the row), so there is nothing to clean up for
    // that case either.
  })

  it('removing one sport from a both-sports member returns false and leaves the other sport untouched', async () => {
    const player = await createPlayer(
      {
        name: `Remove Sport Test Both ${runId}`,
        gender: 'male',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    await updatePlayer(
      player.id,
      { sport: 'tennis', self_selected_level: 'advanced' },
      testWritePassphrase,
    )

    const result = await removePlayerFromSport(
      player.id,
      'badminton',
      testWritePassphrase,
    )
    expect(result).toBe(false)

    const players = await listPlayers()
    const updated = players.find((p) => p.id === player.id)
    expect(updated).toBeDefined()
    expect(updated?.badminton_self_selected_level).toBeNull()
    expect(updated?.tennis_self_selected_level).toBe('advanced')

    const tennisStats = await getPlayerStats(player.id, 'tennis')
    expect(tennisStats?.effective_level).toBe('advanced')
  })

  it('removing a person’s only sport returns true and deletes them', async () => {
    const player = await createPlayer(
      {
        name: `Remove Sport Test Only ${runId}`,
        gender: 'female',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )

    const result = await removePlayerFromSport(
      player.id,
      'badminton',
      testWritePassphrase,
    )
    expect(result).toBe(true)

    const players = await listPlayers()
    expect(players.some((p) => p.id === player.id)).toBe(false)
  })

  it('rejects removal with player_has_matches when the sport has a match_participants row', async () => {
    const playerA = await createPlayer(
      {
        name: `Remove Sport Test Has Match A ${runId}`,
        gender: 'male',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    const playerB = await createPlayer(
      {
        name: `Remove Sport Test Has Match B ${runId}`,
        gender: 'female',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )

    const tournament = await createTournament(
      {
        name: `Remove Sport Test ${runId}`,
        type: 'singles',
        sport: 'badminton',
        games_per_match: 1,
        points_per_game: 21,
        court_count: 1,
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
      removePlayerFromSport(playerA.id, 'badminton', testWritePassphrase),
    ).rejects.toThrow()

    const players = await listPlayers()
    const stillThere = players.find((p) => p.id === playerA.id)
    expect(stillThere).toBeDefined()
    expect(stillThere?.badminton_self_selected_level).not.toBeNull()
  })

  it('rejects removal with not_a_member when the sport already has no level', async () => {
    const player = await createPlayer(
      {
        name: `Remove Sport Test Not Member ${runId}`,
        gender: 'male',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )

    await expect(
      removePlayerFromSport(player.id, 'tennis', testWritePassphrase),
    ).rejects.toThrow()

    const players = await listPlayers()
    const stillThere = players.find((p) => p.id === player.id)
    expect(stillThere).toBeDefined()
    expect(stillThere?.badminton_self_selected_level).not.toBeNull()
  })
})
