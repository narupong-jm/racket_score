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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['drawInputs', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['playerStats'] })
      queryClient.invalidateQueries({
        queryKey: ['tournamentStandingsRanked', tournamentId],
      })
      queryClient.invalidateQueries({
        queryKey: ['tournamentTotalPoints', tournamentId],
      })
    },
  })
}
