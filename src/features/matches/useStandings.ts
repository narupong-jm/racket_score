import { useQuery } from '@tanstack/react-query'
import { getStandings } from './matchesApi'
import { sortStandings } from './sortStandings'

const STANDINGS_POLL_INTERVAL_MS = 30_000

export function useStandings(tournamentId: string) {
  return useQuery({
    queryKey: ['standings', tournamentId],
    queryFn: () => getStandings(tournamentId),
    refetchInterval: STANDINGS_POLL_INTERVAL_MS,
    select: sortStandings,
  })
}
