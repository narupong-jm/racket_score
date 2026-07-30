import { useMutation, useQueryClient } from '@tanstack/react-query'
import { endTournament } from './tournamentsApi'

export function useEndTournament() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tournamentId: string) => endTournament(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })
}
