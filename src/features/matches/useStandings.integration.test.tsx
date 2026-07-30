import { afterAll, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useStandings } from './useStandings'
import { createMatch, recordMatchResult } from './matchesApi'
import { createTournament, addParticipant } from '../tournaments/tournamentsApi'
import { createPlayer } from '../players/playersApi'
import { supabase } from '../../lib/supabaseClient'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useStandings (real project, anon key)', () => {
  const runId = crypto.randomUUID()
  let tournamentId: string | undefined
  const playerIds = {} as Record<'A' | 'B' | 'C', string>

  afterAll(async () => {
    if (tournamentId) {
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId)
      const matchIds = (matches ?? []).map((m) => m.id)
      if (matchIds.length > 0) {
        await supabase.from('match_games').delete().in('match_id', matchIds)
        await supabase.from('match_participants').delete().in('match_id', matchIds)
      }
      await supabase.from('matches').delete().eq('tournament_id', tournamentId)
      await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId)
      await supabase.from('tournaments').delete().eq('id', tournamentId)
    }
    const ids = Object.values(playerIds)
    if (ids.length > 0) {
      await supabase.from('players').delete().in('id', ids)
    }
  })

  it('sorts standings by games won desc, breaking a tie by point differential', async () => {
    const tournament = await createTournament({
      name: `Standings Test ${runId}`,
      type: 'singles',
      games_per_match: 1,
      points_per_game: 21,
    })
    tournamentId = tournament.id

    for (const label of ['A', 'B', 'C'] as const) {
      const player = await createPlayer({
        name: `Standings Test ${label} ${runId}`,
        gender: 'male',
        self_selected_level: 'beginner',
      })
      playerIds[label] = player.id
      await addParticipant(tournamentId, player.id)
    }
    const { A, B, C } = playerIds

    // A beats B 21-10 -> A: +11, B: -11
    const m1 = await createMatch(tournamentId, 1, [
      { player_id: A, team: 1 },
      { player_id: B, team: 2 },
    ])
    await recordMatchResult(m1.id, [{ game_number: 1, team1_score: 21, team2_score: 10 }])

    // B beats C 21-15 -> B cumulative: -11+6=-5, C: -6
    const m2 = await createMatch(tournamentId, 2, [
      { player_id: B, team: 1 },
      { player_id: C, team: 2 },
    ])
    await recordMatchResult(m2.id, [{ game_number: 1, team1_score: 21, team2_score: 15 }])

    // C beats A 21-1 -> C cumulative: -6+20=14, A cumulative: 11-20=-9
    const m3 = await createMatch(tournamentId, 3, [
      { player_id: C, team: 1 },
      { player_id: A, team: 2 },
    ])
    await recordMatchResult(m3.id, [{ game_number: 1, team1_score: 21, team2_score: 1 }])

    // final tally, all tied on games_won=1 (2 played each):
    // A: point_diff = 11 - 20 = -9
    // B: point_diff = -11 + 6 = -5
    // C: point_diff = -6 + 20 = 14

    const { result } = renderHook(() => useStandings(tournamentId!), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const standings = result.current.data!
    expect(standings.every((s) => s.games_won === 1 && s.games_played === 2)).toBe(true)

    expect(standings.map((s) => s.player_id)).toEqual([C, B, A])
    expect(standings.map((s) => s.point_diff)).toEqual([14, -5, -9])
  })
})
