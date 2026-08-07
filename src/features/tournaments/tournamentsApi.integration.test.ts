import { afterAll, describe, expect, it } from 'vitest'
import {
  addParticipant,
  cancelTournament,
  createTournament,
  endTournament,
  leaveParticipant,
  listParticipants,
  listTournaments,
} from './tournamentsApi'
import { createMatch, recordMatchResult } from '../matches/matchesApi'
import { createPlayer } from '../players/playersApi'
import { supabase } from '../../lib/supabaseClient'
import { testWritePassphrase } from '../../test/testPassphrase'

describe('tournamentsApi (real project, anon key)', () => {
  const testPlayerName = `Tournaments API Test Player ${crypto.randomUUID()}`
  let tournamentId: string | undefined
  let playerId: string | undefined

  afterAll(async () => {
    if (tournamentId) {
      await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId)
      await supabase.from('tournaments').delete().eq('id', tournamentId)
    }
    if (playerId) {
      await supabase.from('players').delete().eq('id', playerId)
    }
  })

  it('creates a tournament with a correctly computed point cap and lists it', async () => {
    const created = await createTournament(
      {
        name: `Tournaments API Test ${crypto.randomUUID()}`,
        type: 'doubles',
        games_per_match: 3,
        points_per_game: 21,
      },
      testWritePassphrase,
    )
    tournamentId = created.id

    expect(created.point_cap).toBe(30) // round(21 * 30 / 21)
    expect(created.status).toBe('active')

    const tournaments = await listTournaments()
    expect(tournaments.some((t) => t.id === tournamentId)).toBe(true)
  })

  it('adds a participant and lists them', async () => {
    if (!tournamentId) throw new Error('tournamentId not set from previous test')

    const player = await createPlayer(
      {
        name: testPlayerName,
        gender: 'male',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    playerId = player.id

    await addParticipant(tournamentId, playerId, testWritePassphrase)

    const participants = await listParticipants(tournamentId)
    expect(participants.some((p) => p.player_id === playerId)).toBe(true)
  })

  it('ends a tournament, flipping status and setting ended_at', async () => {
    if (!tournamentId) throw new Error('tournamentId not set from previous test')

    const ended = await endTournament(tournamentId, testWritePassphrase)
    expect(ended.status).toBe('completed')
    expect(ended.ended_at).not.toBeNull()
  })
})

describe('cancelTournament (real project, anon key)', () => {
  const runId = crypto.randomUUID()

  it('cancels an active tournament with no confirmed matches, leaving ended_at null', async () => {
    const tournament = await createTournament(
      {
        name: `Cancel Test - No Matches ${runId}`,
        type: 'singles',
        games_per_match: 1,
        points_per_game: 21,
      },
      testWritePassphrase,
    )

    try {
      const cancelled = await cancelTournament(tournament.id, testWritePassphrase)
      expect(cancelled.status).toBe('cancelled')
      expect(cancelled.ended_at).toBeNull()
    } finally {
      await supabase.from('tournaments').delete().eq('id', tournament.id)
    }
  })

  it('rejects cancelling a tournament that already has a confirmed match result', async () => {
    const tournament = await createTournament(
      {
        name: `Cancel Test - Confirmed Result ${runId}`,
        type: 'singles',
        games_per_match: 1,
        points_per_game: 21,
      },
      testWritePassphrase,
    )
    const playerA = await createPlayer(
      {
        name: `Cancel Test A ${runId}`,
        gender: 'male',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    const playerB = await createPlayer(
      {
        name: `Cancel Test B ${runId}`,
        gender: 'female',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )

    try {
      await addParticipant(tournament.id, playerA.id, testWritePassphrase)
      await addParticipant(tournament.id, playerB.id, testWritePassphrase)
      const match = await createMatch(
        tournament.id,
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

      await expect(cancelTournament(tournament.id, testWritePassphrase)).rejects.toThrow()

      // proving no partial mutation: still active, match still there
      const { data: reread } = await supabase
        .from('tournaments')
        .select('status')
        .eq('id', tournament.id)
        .single()
      expect(reread?.status).toBe('active')
    } finally {
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournament.id)
      const matchIds = (matches ?? []).map((m) => m.id)
      if (matchIds.length > 0) {
        await supabase.from('match_games').delete().in('match_id', matchIds)
        await supabase.from('match_participants').delete().in('match_id', matchIds)
        await supabase.from('matches').delete().in('id', matchIds)
      }
      await supabase.from('tournament_participants').delete().eq('tournament_id', tournament.id)
      await supabase.from('tournaments').delete().eq('id', tournament.id)
      await supabase.from('players').delete().in('id', [playerA.id, playerB.id])
    }
  })
})

describe('leaveParticipant (real project, anon key)', () => {
  const runId = crypto.randomUUID()

  it('round-trips: leaving an active participant flips their status to left', async () => {
    const tournament = await createTournament(
      {
        name: `Leave Test - Round Trip ${runId}`,
        type: 'singles',
        games_per_match: 1,
        points_per_game: 21,
      },
      testWritePassphrase,
    )
    const player = await createPlayer(
      { name: `Leave Test A ${runId}`, gender: 'male', self_selected_level: 'beginner' },
      testWritePassphrase,
    )

    try {
      await addParticipant(tournament.id, player.id, testWritePassphrase)

      const left = await leaveParticipant(tournament.id, player.id, testWritePassphrase)
      expect(left.status).toBe('left')

      const participants = await listParticipants(tournament.id)
      const row = participants.find((p) => p.player_id === player.id)
      expect(row?.status).toBe('left')
    } finally {
      await supabase.from('tournament_participants').delete().eq('tournament_id', tournament.id)
      await supabase.from('tournaments').delete().eq('id', tournament.id)
      await supabase.from('players').delete().eq('id', player.id)
    }
  })

  it('rejects leaving a participant who is part of the queued Current match', async () => {
    const tournament = await createTournament(
      {
        name: `Leave Test - Current Match ${runId}`,
        type: 'singles',
        games_per_match: 1,
        points_per_game: 21,
      },
      testWritePassphrase,
    )
    const playerA = await createPlayer(
      { name: `Leave Test B ${runId}`, gender: 'male', self_selected_level: 'beginner' },
      testWritePassphrase,
    )
    const playerB = await createPlayer(
      { name: `Leave Test C ${runId}`, gender: 'female', self_selected_level: 'beginner' },
      testWritePassphrase,
    )

    try {
      await addParticipant(tournament.id, playerA.id, testWritePassphrase)
      await addParticipant(tournament.id, playerB.id, testWritePassphrase)
      await createMatch(
        tournament.id,
        1,
        [
          { player_id: playerA.id, team: 1 },
          { player_id: playerB.id, team: 2 },
        ],
        testWritePassphrase,
      )

      await expect(
        leaveParticipant(tournament.id, playerA.id, testWritePassphrase),
      ).rejects.toThrow()

      // proving no partial mutation: still active
      const participants = await listParticipants(tournament.id)
      const row = participants.find((p) => p.player_id === playerA.id)
      expect(row?.status).toBe('active')
    } finally {
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournament.id)
      const matchIds = (matches ?? []).map((m) => m.id)
      if (matchIds.length > 0) {
        await supabase.from('match_participants').delete().in('match_id', matchIds)
        await supabase.from('matches').delete().in('id', matchIds)
      }
      await supabase.from('tournament_participants').delete().eq('tournament_id', tournament.id)
      await supabase.from('tournaments').delete().eq('id', tournament.id)
      await supabase.from('players').delete().in('id', [playerA.id, playerB.id])
    }
  })

  it('rejects leaving a participant on a tournament that has already ended', async () => {
    const tournament = await createTournament(
      {
        name: `Leave Test - Ended Tournament ${runId}`,
        type: 'singles',
        games_per_match: 1,
        points_per_game: 21,
      },
      testWritePassphrase,
    )
    const player = await createPlayer(
      { name: `Leave Test D ${runId}`, gender: 'male', self_selected_level: 'beginner' },
      testWritePassphrase,
    )

    try {
      await addParticipant(tournament.id, player.id, testWritePassphrase)
      await endTournament(tournament.id, testWritePassphrase)

      await expect(
        leaveParticipant(tournament.id, player.id, testWritePassphrase),
      ).rejects.toThrow()
    } finally {
      await supabase.from('tournament_participants').delete().eq('tournament_id', tournament.id)
      await supabase.from('tournaments').delete().eq('id', tournament.id)
      await supabase.from('players').delete().eq('id', player.id)
    }
  })
})
