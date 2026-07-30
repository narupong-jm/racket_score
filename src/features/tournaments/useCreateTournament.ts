import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTournament, type CreateTournamentInput } from './tournamentsApi'

export function useCreateTournament() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTournamentInput) => createTournament(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })
}
