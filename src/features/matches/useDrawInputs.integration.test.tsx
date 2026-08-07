import { afterAll, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDrawInputs } from './useDrawInputs'
import { createMatch, recordMatchResult } from './matchesApi'
import {
  createTournament,
  addParticipant,
  leaveParticipant,
} from '../tournaments/tournamentsApi'
import { createPlayer } from '../players/playersApi'
import { canonicalPairKey } from '../matchmaking/pairKey'
import { supabase } from '../../lib/supabaseClient'
import { testWritePassphrase } from '../../test/testPassphrase'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('useDrawInputs (real project, anon key)', () => {
  const runId = crypto.randomUUID()
  let tournamentId: string | undefined
  const playerIds = {} as Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', string>

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
    const ids = Object.values(playerIds)
    if (ids.length > 0) {
      await supabase.from('players').delete().in('id', ids)
    }
  })

  it('assembles candidates and pairing history from a seeded fixture tournament', async () => {
    // more real network round-trips than the default 5s allows, now that this test
    // also seeds a left participant (E) and a mid-tournament join (F)
    const tournament = await createTournament(
      {
        name: `Draw Inputs Test ${runId}`,
        type: 'doubles',
        games_per_match: 1,
        points_per_game: 21,
      },
      testWritePassphrase,
    )
    tournamentId = tournament.id

    const levels = {
      A: 'beginner',
      B: 'intermediate',
      C: 'advanced',
      D: 'pro',
    } as const
    const genders = { A: 'male', B: 'female', C: 'male', D: 'female' } as const
    for (const label of ['A', 'B', 'C', 'D'] as const) {
      const player = await createPlayer(
        {
          name: `Draw Inputs Test ${label} ${runId}`,
          gender: genders[label],
          self_selected_level: levels[label],
        },
        testWritePassphrase,
      )
      playerIds[label] = player.id
      await addParticipant(tournamentId, player.id, testWritePassphrase)
    }
    const { A, B, C, D } = playerIds

    // E joins then immediately leaves -- must be excluded from candidates entirely,
    // with no reuse fallback (unlike the Current-match exclusion).
    const playerE = await createPlayer(
      {
        name: `Draw Inputs Test E ${runId}`,
        gender: 'male',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    playerIds.E = playerE.id
    await addParticipant(tournamentId, playerE.id, testWritePassphrase)
    await leaveParticipant(tournamentId, playerE.id, testWritePassphrase)

    // F is created now but only added mid-tournament, after match 1
    const playerF = await createPlayer(
      {
        name: `Draw Inputs Test F ${runId}`,
        gender: 'female',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    playerIds.F = playerF.id

    // match 1 (completed): team1={A,B} vs team2={C,D}
    const match1 = await createMatch(
      tournamentId,
      1,
      [
        { player_id: A, team: 1 },
        { player_id: B, team: 1 },
        { player_id: C, team: 2 },
        { player_id: D, team: 2 },
      ],
      testWritePassphrase,
    )
    await recordMatchResult(
      match1.id,
      [{ game_number: 1, team1_score: 21, team2_score: 10 }],
      testWritePassphrase,
    )

    // match 2 (completed): team1={A,C} vs team2={B,D}
    const match2 = await createMatch(
      tournamentId,
      2,
      [
        { player_id: A, team: 1 },
        { player_id: C, team: 1 },
        { player_id: B, team: 2 },
        { player_id: D, team: 2 },
      ],
      testWritePassphrase,
    )
    await recordMatchResult(
      match2.id,
      [{ game_number: 1, team1_score: 21, team2_score: 10 }],
      testWritePassphrase,
    )

    // F joins now, after A/B/C/D each have 2 real completed matches -- their fairness
    // offset should land them at the current active minimum (2), with 0 real matches.
    await addParticipant(tournamentId, playerF.id, testWritePassphrase)

    // match 3 (still queued): team1={A,D} vs team2={B,C} -- must NOT count
    await createMatch(
      tournamentId,
      3,
      [
        { player_id: A, team: 1 },
        { player_id: D, team: 1 },
        { player_id: B, team: 2 },
        { player_id: C, team: 2 },
      ],
      testWritePassphrase,
    )

    const { result } = renderHook(() => useDrawInputs(tournamentId!), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const { candidates, pairingHistory } = result.current.data!

    // E (added then left) is excluded entirely; F (mid-tournament join) is included.
    expect(candidates).toHaveLength(5)
    const byId = new Map(candidates.map((c) => [c.id, c]))
    expect(byId.get(A)).toMatchObject({ gender: 'male', skillValue: 12.5 })
    expect(byId.get(B)).toMatchObject({ gender: 'female', skillValue: 37.5 })
    expect(byId.get(C)).toMatchObject({ gender: 'male', skillValue: 62.5 })
    expect(byId.get(D)).toMatchObject({ gender: 'female', skillValue: 87.5 })
    expect(byId.get(playerIds.E)).toBeUndefined()

    // only the 2 completed matches count -- the queued match must be excluded, and
    // A/B/C/D's real counts are unaffected by F's later mid-tournament join
    for (const id of [A, B, C, D]) {
      expect(byId.get(id)?.matchesPlayedInTournament).toBe(2)
    }

    // F has 0 real completed matches but joined with a fairness offset of 2 (the
    // active minimum at join time), so their draw-facing count is real + offset = 2
    expect(byId.get(playerIds.F)).toMatchObject({
      matchesPlayedInTournament: 2,
    })

    expect(pairingHistory.teammatePairs).toEqual(
      new Set([
        canonicalPairKey(A, B),
        canonicalPairKey(C, D),
        canonicalPairKey(A, C),
        canonicalPairKey(B, D),
      ]),
    )
    // A-D and B-C were only teammates in the still-queued match 3
    expect(pairingHistory.teammatePairs.has(canonicalPairKey(A, D))).toBe(false)
    expect(pairingHistory.teammatePairs.has(canonicalPairKey(B, C))).toBe(false)

    expect(pairingHistory.opponentPairs).toEqual(
      new Set([
        canonicalPairKey(A, C),
        canonicalPairKey(A, D),
        canonicalPairKey(B, C),
        canonicalPairKey(B, D),
        canonicalPairKey(A, B),
        canonicalPairKey(C, D),
      ]),
    )
  }, 20000)
})
