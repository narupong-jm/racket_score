import { afterAll, describe, expect, it } from 'vitest'
import {
  addParticipant,
  createTournament,
  endTournament,
  listParticipants,
  listTournaments,
} from './tournamentsApi'
import { createPlayer } from '../players/playersApi'
import { supabase } from '../../lib/supabaseClient'

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
    const created = await createTournament({
      name: `Tournaments API Test ${crypto.randomUUID()}`,
      type: 'doubles',
      games_per_match: 3,
      points_per_game: 21,
    })
    tournamentId = created.id

    expect(created.point_cap).toBe(30) // round(21 * 30 / 21)
    expect(created.status).toBe('active')

    const tournaments = await listTournaments()
    expect(tournaments.some((t) => t.id === tournamentId)).toBe(true)
  })

  it('adds a participant and lists them', async () => {
    if (!tournamentId) throw new Error('tournamentId not set from previous test')

    const player = await createPlayer({
      name: testPlayerName,
      gender: 'male',
      self_selected_level: 'beginner',
    })
    playerId = player.id

    await addParticipant(tournamentId, playerId)

    const participants = await listParticipants(tournamentId)
    expect(participants.some((p) => p.player_id === playerId)).toBe(true)
  })

  it('ends a tournament, flipping status and setting ended_at', async () => {
    if (!tournamentId) throw new Error('tournamentId not set from previous test')

    const ended = await endTournament(tournamentId)
    expect(ended.status).toBe('completed')
    expect(ended.ended_at).not.toBeNull()
  })
})
