import { useMutation, useQueryClient } from '@tanstack/react-query'
import { leaveParticipant } from './tournamentsApi'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'

export function useLeaveParticipant(tournamentId: string) {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()
  return useMutation({
    mutationFn: async (playerId: string) => {
      const passphrase = await getPassphrase()
      return leaveParticipant(tournamentId, playerId, passphrase)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentParticipants', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['drawInputs', tournamentId] })
    },
  })
}
