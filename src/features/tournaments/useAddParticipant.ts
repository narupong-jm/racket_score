import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addParticipant } from './tournamentsApi'

export function useAddParticipant(tournamentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (playerId: string) => addParticipant(tournamentId, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentParticipants', tournamentId] })
    },
  })
}
