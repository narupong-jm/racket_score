import { useMutation, useQueryClient } from '@tanstack/react-query'
import { generateNextMatch, type GenerateNextMatchResult } from '../matchmaking/generateNextMatch'
import type { MatchType } from '../matchmaking/types'
import { createMatch, listMatches, type Match } from './matchesApi'
import { assembleDrawInputs } from './useDrawInputs'

export type DrawNextMatchOutcome =
  | { ok: true; match: Match }
  | Extract<GenerateNextMatchResult, { ok: false }>

export function useDrawNextMatch(tournamentId: string, matchType: MatchType) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<DrawNextMatchOutcome> => {
      const [drawInputs, matches] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['drawInputs', tournamentId],
          queryFn: () => assembleDrawInputs(tournamentId),
        }),
        listMatches(tournamentId),
      ])

      const result = generateNextMatch(
        matchType,
        drawInputs.candidates,
        drawInputs.pairingHistory,
      )

      if (result.ok) {
        const nextSequenceNumber =
          matches.reduce((max, m) => Math.max(max, m.sequence_number), 0) + 1

        const match = await createMatch(
          tournamentId,
          nextSequenceNumber,
          result.participants.map((p) => ({ player_id: p.playerId, team: p.team })),
        )

        return { ok: true, match }
      }

      return { ok: false, error: 'not_enough_players' }
    },
    onSuccess: (outcome) => {
      if (outcome.ok) {
        queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      }
    },
  })
}
