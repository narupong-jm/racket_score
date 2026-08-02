import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cancelTournament } from './tournamentsApi'

export function useCancelTournament() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tournamentId: string) => cancelTournament(tournamentId),
    onSuccess: (_data, tournamentId) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
    },
  })
}
