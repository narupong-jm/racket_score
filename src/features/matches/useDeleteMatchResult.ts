import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteMatchResult } from './matchesApi'

export function useDeleteMatchResult() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      matchId,
      passphrase,
    }: {
      matchId: string
      passphrase: string
    }) => {
      return deleteMatchResult(matchId, passphrase)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      queryClient.invalidateQueries({ queryKey: ['drawInputs'] })
      queryClient.invalidateQueries({ queryKey: ['playerStats'] })
      queryClient.invalidateQueries({
        queryKey: ['tournamentStandingsRanked'],
      })
      queryClient.invalidateQueries({ queryKey: ['tournamentTotalPoints'] })
      queryClient.invalidateQueries({ queryKey: ['recentCompletedMatches'] })
      queryClient.invalidateQueries({ queryKey: ['overallScoreboard'] })
    },
  })
}
