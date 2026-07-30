import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordMatchResult, type GameResultInput } from './matchesApi'

export function useRecordMatchResult(tournamentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, games }: { matchId: string; games: GameResultInput[] }) =>
      recordMatchResult(matchId, games),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['drawInputs', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['playerStats'] })
    },
  })
}
