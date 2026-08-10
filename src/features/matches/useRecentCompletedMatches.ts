import { useQuery } from '@tanstack/react-query'
import { listRecentCompletedMatches } from './matchesApi'
import type { Sport } from '../sport/sportTypes'

export function useRecentCompletedMatches(sport: Sport) {
  return useQuery({
    queryKey: ['recentCompletedMatches', sport],
    queryFn: () => listRecentCompletedMatches(sport),
  })
}
