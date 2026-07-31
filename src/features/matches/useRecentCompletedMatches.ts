import { useQuery } from '@tanstack/react-query'
import { listRecentCompletedMatches } from './matchesApi'

export function useRecentCompletedMatches() {
  return useQuery({
    queryKey: ['recentCompletedMatches'],
    queryFn: listRecentCompletedMatches,
  })
}
