import { useQuery } from '@tanstack/react-query'
import { listTournaments } from './tournamentsApi'

export function useTournaments() {
  return useQuery({
    queryKey: ['tournaments'],
    queryFn: listTournaments,
  })
}
