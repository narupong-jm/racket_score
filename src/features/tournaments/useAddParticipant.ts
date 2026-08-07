import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addParticipant } from './tournamentsApi'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'

export function useAddParticipant(tournamentId: string) {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()
  return useMutation({
    mutationFn: async (playerId: string) => {
      const passphrase = await getPassphrase()
      return addParticipant(tournamentId, playerId, passphrase)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tournamentParticipants', tournamentId],
      })
      queryClient.invalidateQueries({ queryKey: ['drawInputs', tournamentId] })
    },
  })
}
