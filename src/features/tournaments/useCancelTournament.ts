import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cancelTournament } from './tournamentsApi'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'

export function useCancelTournament() {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()
  return useMutation({
    mutationFn: async (tournamentId: string) => {
      const passphrase = await getPassphrase()
      return cancelTournament(tournamentId, passphrase)
    },
    onSuccess: (_data, tournamentId) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
    },
  })
}
