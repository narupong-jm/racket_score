import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordMatchResult, type GameResultInput } from './matchesApi'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'

export function useRecordMatchResult(tournamentId: string) {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()
  return useMutation({
    mutationFn: async ({
      matchId,
      games,
    }: {
      matchId: string
      games: GameResultInput[]
    }) => {
      const passphrase = await getPassphrase()
      return recordMatchResult(matchId, games, passphrase)
    },
    // Returned (awaited) so a draw right after Save sees the finished players'
    // completed match rather than stale rosters.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] }),
        queryClient.invalidateQueries({
          queryKey: ['drawInputs', tournamentId],
        }),
        queryClient.invalidateQueries({ queryKey: ['playerStats'] }),
        queryClient.invalidateQueries({
          queryKey: ['tournamentStandingsRanked', tournamentId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['tournamentTotalPoints', tournamentId],
        }),
      ]),
  })
}
