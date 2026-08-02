import { useMutation, useQueryClient } from '@tanstack/react-query'
import { endTournament } from './tournamentsApi'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'

export function useEndTournament() {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()
  return useMutation({
    mutationFn: async (tournamentId: string) => {
      const passphrase = await getPassphrase()
      return endTournament(tournamentId, passphrase)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })
}
