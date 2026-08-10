import { useQuery } from '@tanstack/react-query'
import { listTournaments } from './tournamentsApi'
import type { Sport } from '../sport/sportTypes'

export function useTournaments(sport?: Sport) {
  return useQuery({
    queryKey: ['tournaments', sport ?? 'all'],
    queryFn: () => listTournaments(sport),
  })
}
