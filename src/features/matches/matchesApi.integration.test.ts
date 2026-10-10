import { afterAll, describe, expect, it } from 'vitest'
import {
  createMatch,
  deleteMatchResult,
  getMatchHistory,
  listRecentCompletedMatches,
  recordMatchResult,
} from './matchesApi'
import {
  addParticipant,
  cancelTournament,
  createTournament,
  endTournament,
  leaveParticipant,
} from '../tournaments/tournamentsApi'
import { createPlayer, removePlayerFromSport } from '../players/playersApi'
import { supabase } from '../../lib/supabaseClient'
import { testWritePassphrase } from '../../test/testPassphrase'

describe('matchesApi: manually_adjusted flag (real project, anon key)', () => {
  it('defaults to false and can be set true via the manuallyAdjusted param', async () => {
    const runId = crypto.randomUUID()
    const tournament = await createTournament(
      {
        name: `Manually Adjusted Test ${runId}`,
        type: 'singles',
        sport: 'badminton',
        games_per_match: 1,
        points_per_game: 21,
        court_count: 1,
      },
      testWritePassphrase,
    )
    const playerA = await createPlayer(
      {
        name: `Manually Adjusted A ${runId}`,
        gender: 'male',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    const playerB = await createPlayer(
      {
        name: `Manually Adjusted B ${runId}`,
        gender: 'female',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    await addParticipant(tournament.id, playerA.id, testWritePassphrase)
    await addParticipant(tournament.id, playerB.id, testWritePassphrase)

    try {
      const defaultMatch = await createMatch(
        tournament.id,
        1,
        [
          { player_id: playerA.id, team: 1 },
          { player_id: playerB.id, team: 2 },
        ],
        testWritePassphrase,
      )
      expect(defaultMatch.manually_adjusted).toBe(false)
      await recordMatchResult(
        defaultMatch.id,
        [{ game_number: 1, team1_score: 21, team2_score: 15 }],
        testWritePassphrase,
      )

      const adjustedMatch = await createMatch(
        tournament.id,
        1,
        [
          { player_id: playerA.id, team: 1 },
          { player_id: playerB.id, team: 2 },
        ],
        testWritePassphrase,
        true,
      )
      expect(adjustedMatch.manually_adjusted).toBe(true)
    } finally {
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournament.id)
      const matchIds = (matches ?? []).map((m) => m.id)
      if (matchIds.length > 0) {
        await supabase
          .from('match_participants')
          .delete()
          .in('match_id', matchIds)
        await supabase.from('matches').delete().in('id', matchIds)
      }
      await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournament.id)
      await supabase.from('tournaments').delete().eq('id', tournament.id)
      await supabase.from('players').delete().in('id', [playerA.id, playerB.id])
    }
    // ~10 sequential real-network calls: the 5 s default flakes on a cold start.
  }, 20_000)
})

describe('matchesApi (real project, anon key)', () => {
  const runId = crypto.randomUUID()
  let tournamentId: string | undefined
  const playerIds: string[] = []
  let matchId: string | undefined

  afterAll(async () => {
    if (tournamentId) {
      await supabase
        .from('match_games')
        .delete()
        .in('match_id', matchId ? [matchId] : [])
      await supabase
        .from('match_participants')
        .delete()
        .in('match_id', matchId ? [matchId] : [])
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

  it('seeds 4 players in a doubles tournament', async () => {
    const tournament = await createTournament(
      {
        name: `Matches API Test ${runId}`,
        type: 'doubles',
        sport: 'badminton',
        games_per_match: 3,
        points_per_game: 21,
        court_count: 1,
      },
      testWritePassphrase,
    )
    tournamentId = tournament.id

    for (const label of ['A', 'B', 'C', 'D']) {
      const player = await createPlayer(
        {
          name: `Matches API Test ${label} ${runId}`,
          gender: label === 'A' || label === 'C' ? 'male' : 'female',
          sport: 'badminton',
          self_selected_level: 'beginner',
        },
        testWritePassphrase,
      )
      playerIds.push(player.id)
      await addParticipant(tournamentId, player.id, testWritePassphrase)
    }
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
      createMatch(
        tournamentId,
        1,
        [
          { player_id: a, team: 1 },
          { player_id: b, team: 1 },
          { player_id: c, team: 2 },
          { player_id: bogusPlayerId, team: 2 }, // violates FK -> whole call must fail
        ],
        testWritePassphrase,
      ),
    ).rejects.toThrow()

    const { count: afterCount } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    expect(afterCount).toBe(beforeCount) // no orphan `matches` row left behind
  })

  it('creates a doubles match via the atomic RPC', async () => {
    if (!tournamentId) throw new Error('tournamentId not set')
    const [a, b, c, d] = playerIds

    const match = await createMatch(
      tournamentId,
      1,
      [
        { player_id: a, team: 1 },
        { player_id: b, team: 1 },
        { player_id: c, team: 2 },
        { player_id: d, team: 2 },
      ],
      testWritePassphrase,
    )
    matchId = match.id
    expect(match.status).toBe('queued')

    // getMatchHistory only reflects completed matches -- a queued (unplayed) match
    // must not count as a pairing/repeat yet.
    const history = await getMatchHistory(tournamentId)
    expect(history).toHaveLength(0)
  })

  it('records a match result and reflects it in match history', async () => {
    if (!tournamentId || !matchId) throw new Error('setup not complete')

    const result = await recordMatchResult(
      matchId,
      [
        { game_number: 1, team1_score: 21, team2_score: 15 },
        { game_number: 2, team1_score: 21, team2_score: 18 },
      ],
      testWritePassphrase,
    )
    expect(result.status).toBe('completed')

    // now that the match is completed, it must show up in match history
    const history = await getMatchHistory(tournamentId)
    expect(history).toHaveLength(4)
    expect(
      history.filter((h) => h.match_id === matchId && h.team === 1),
    ).toHaveLength(2)
  })
})

describe('matchesApi: deleteMatchResult (real project, anon key)', () => {
  const runId = crypto.randomUUID()
  let tournamentId: string | undefined
  const playerIds: string[] = []
  let matchToDeleteId: string | undefined
  let matchToKeepId: string | undefined

  afterAll(async () => {
    // Each step below is independent best-effort cleanup: a failure in one
    // (e.g. matchToKeepId never got set because an earlier test failed)
    // must not prevent the rest from running.
    if (matchToKeepId) {
      try {
        await deleteMatchResult(matchToKeepId, testWritePassphrase)
      } catch {
        // best-effort cleanup only
      }
    }
    if (tournamentId) {
      for (const playerId of playerIds) {
        try {
          await leaveParticipant(tournamentId, playerId, testWritePassphrase)
        } catch {
          // best-effort cleanup only
        }
      }
    }
    for (const playerId of playerIds) {
      try {
        await removePlayerFromSport(playerId, 'badminton', testWritePassphrase)
      } catch {
        // best-effort cleanup only
      }
    }
    // There is currently no RPC that hard-deletes a tournament, and `anon`
    // has no direct DELETE privilege on `tournaments`/`tournament_participants`
    // (Phase 16), so these raw deletes are known no-ops left in place only
    // for documentation purposes -- matching the same known gap described in
    // `deletePlayer.integration.test.ts`'s own `afterAll`.
    if (tournamentId) {
      await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournamentId)
      await supabase.from('tournaments').delete().eq('id', tournamentId)
    }
  })

  it('sets up a singles tournament with two players and two completed matches', async () => {
    const tournament = await createTournament(
      {
        name: `Delete Match Test ${runId}`,
        type: 'singles',
        sport: 'badminton',
        games_per_match: 1,
        points_per_game: 21,
        court_count: 1,
      },
      testWritePassphrase,
    )
    tournamentId = tournament.id

    const playerA = await createPlayer(
      {
        name: `Delete Match Test A ${runId}`,
        gender: 'male',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    const playerB = await createPlayer(
      {
        name: `Delete Match Test B ${runId}`,
        gender: 'female',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    playerIds.push(playerA.id, playerB.id)
    await addParticipant(tournamentId, playerA.id, testWritePassphrase)
    await addParticipant(tournamentId, playerB.id, testWritePassphrase)

    const matchToDelete = await createMatch(
      tournamentId,
      1,
      [
        { player_id: playerA.id, team: 1 },
        { player_id: playerB.id, team: 2 },
      ],
      testWritePassphrase,
    )
    matchToDeleteId = matchToDelete.id
    await recordMatchResult(
      matchToDeleteId,
      [{ game_number: 1, team1_score: 21, team2_score: 15 }],
      testWritePassphrase,
    )

    const matchToKeep = await createMatch(
      tournamentId,
      1,
      [
        { player_id: playerA.id, team: 1 },
        { player_id: playerB.id, team: 2 },
      ],
      testWritePassphrase,
    )
    matchToKeepId = matchToKeep.id
    await recordMatchResult(
      matchToKeepId,
      [{ game_number: 1, team1_score: 21, team2_score: 10 }],
      testWritePassphrase,
    )
  })

  it('create+record+delete round trip: the match disappears from listRecentCompletedMatches', async () => {
    if (!matchToDeleteId) throw new Error('matchToDeleteId not set')

    const beforeDelete = await listRecentCompletedMatches('badminton')
    expect(
      beforeDelete.some((entry) => entry.match.id === matchToDeleteId),
    ).toBe(true)
    expect(
      beforeDelete.find((entry) => entry.match.id === matchToDeleteId)
        ?.courtCount,
    ).toBe(1)

    await deleteMatchResult(matchToDeleteId, testWritePassphrase)

    const afterDelete = await listRecentCompletedMatches('badminton')
    expect(
      afterDelete.some((entry) => entry.match.id === matchToDeleteId),
    ).toBe(false)
  })

  it('rejects a wrong passphrase and leaves the match unaffected', async () => {
    if (!matchToKeepId) throw new Error('matchToKeepId not set')

    await expect(
      deleteMatchResult(matchToKeepId, `${testWritePassphrase}-wrong`),
    ).rejects.toThrow()

    const { data: stillThere, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchToKeepId)
      .single()
    expect(error).toBeNull()
    expect(stillThere?.status).toBe('completed')
  })
})

describe('matchesApi: multi-court createMatch (real project, anon key)', () => {
  const runId = crypto.randomUUID()
  let tournamentId: string
  let a: string, b: string, c: string, d: string
  let court1MatchId: string
  let court2MatchId: string

  const pair = (x: string, y: string) => [
    { player_id: x, team: 1 as const },
    { player_id: y, team: 2 as const },
  ]
  const win = [{ game_number: 1, team1_score: 21, team2_score: 15 }]

  it('sets up a 2-court singles tournament with 4 players', async () => {
    const tournament = await createTournament(
      {
        name: `Multi-Court Match ${runId}`,
        type: 'singles',
        sport: 'badminton',
        games_per_match: 1,
        points_per_game: 21,
        court_count: 2,
      },
      testWritePassphrase,
    )
    tournamentId = tournament.id
    const ids: string[] = []
    for (const [i, label] of ['A', 'B', 'C', 'D'].entries()) {
      const player = await createPlayer(
        {
          name: `Multi-Court Match ${label} ${runId}`,
          gender: i % 2 === 0 ? 'male' : 'female',
          sport: 'badminton',
          self_selected_level: 'beginner',
        },
        testWritePassphrase,
      )
      ids.push(player.id)
      await addParticipant(tournamentId, player.id, testWritePassphrase)
    }
    ;[a, b, c, d] = ids
  })

  it('rejects a wrong passphrase before any other validation', async () => {
    await expect(
      createMatch(tournamentId, 0, pair(a, b), `${testWritePassphrase}-wrong`),
    ).rejects.toMatchObject({ message: 'invalid_passphrase' })
  })

  it('rejects a court outside 1..court_count with invalid_court', async () => {
    for (const court of [0, 3]) {
      await expect(
        createMatch(tournamentId, court, pair(a, b), testWritePassphrase),
      ).rejects.toMatchObject({ message: 'invalid_court' })
    }
  })

  it('starts two courts back to back with sequence numbers 1 and 2', async () => {
    const m1 = await createMatch(
      tournamentId,
      1,
      pair(a, b),
      testWritePassphrase,
    )
    const m2 = await createMatch(
      tournamentId,
      2,
      pair(c, d),
      testWritePassphrase,
    )
    court1MatchId = m1.id
    court2MatchId = m2.id
    expect([m1.court_number, m1.sequence_number]).toEqual([1, 1])
    expect([m2.court_number, m2.sequence_number]).toEqual([2, 2])
    expect(m1.status).toBe('queued')
    expect(m2.status).toBe('queued')
  })

  it('rejects starting on an occupied court with court_occupied', async () => {
    await expect(
      createMatch(tournamentId, 1, pair(a, b), testWritePassphrase),
    ).rejects.toMatchObject({ message: 'court_occupied' })
  })

  it('rejects a player already on another court with participant_on_court', async () => {
    await recordMatchResult(court2MatchId, win, testWritePassphrase)
    // court 2 is free again, but A is still playing on court 1
    await expect(
      createMatch(tournamentId, 2, pair(a, c), testWritePassphrase),
    ).rejects.toMatchObject({ message: 'participant_on_court' })
  })

  it('lets a player start again once their previous match has a result', async () => {
    await recordMatchResult(court1MatchId, win, testWritePassphrase)
    const same = await createMatch(
      tournamentId,
      1,
      pair(a, b),
      testWritePassphrase,
    )
    expect([same.court_number, same.sequence_number]).toEqual([1, 3])
    const other = await createMatch(
      tournamentId,
      2,
      pair(c, d),
      testWritePassphrase,
    )
    expect([other.court_number, other.sequence_number]).toEqual([2, 4])
  })

  it('rejects starting a match on a cancelled tournament with tournament_not_active', async () => {
    const cancelled = await createTournament(
      {
        name: `Multi-Court Match Cancelled ${runId}`,
        type: 'singles',
        sport: 'badminton',
        games_per_match: 1,
        points_per_game: 21,
        court_count: 2,
      },
      testWritePassphrase,
    )
    await cancelTournament(cancelled.id, testWritePassphrase)
    await expect(
      createMatch(cancelled.id, 1, pair(a, b), testWritePassphrase),
    ).rejects.toMatchObject({ message: 'tournament_not_active' })
  })

  it('rejects starting a match on an ended tournament with tournament_not_active', async () => {
    const ended = await createTournament(
      {
        name: `Multi-Court Match Ended ${runId}`,
        type: 'singles',
        sport: 'badminton',
        games_per_match: 1,
        points_per_game: 21,
        court_count: 2,
      },
      testWritePassphrase,
    )
    await endTournament(ended.id, testWritePassphrase)
    await expect(
      createMatch(ended.id, 1, pair(a, b), testWritePassphrase),
    ).rejects.toMatchObject({ message: 'tournament_not_active' })
  })
})
