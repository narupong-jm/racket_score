import { useQuery } from '@tanstack/react-query'
import { listPlayerStats } from './playersApi'
import type { Sport } from '../sport/sportTypes'

export function usePlayerStatsList(sport: Sport) {
  return useQuery({
    queryKey: ['playerStats', sport],
    queryFn: () => listPlayerStats(sport),
  })
}
