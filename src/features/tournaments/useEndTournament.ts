import { useMutation, useQueryClient } from '@tanstack/react-query'
import { endTournament } from './tournamentsApi'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'
import { clearQueue } from '../../lib/matchQueueStore'

export function useEndTournament() {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()
  return useMutation({
    mutationFn: async (tournamentId: string) => {
      const passphrase = await getPassphrase()
      return endTournament(tournamentId, passphrase)
    },
    onSuccess: (_data, tournamentId) => {
      clearQueue(tournamentId)
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })
}
