import { useQuery } from '@tanstack/react-query'
import { listPlayerStats } from './playersApi'

export function usePlayerStatsList() {
  return useQuery({
    queryKey: ['playerStats'],
    queryFn: listPlayerStats,
  })
}
