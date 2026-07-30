import { useQuery } from '@tanstack/react-query'
import { listParticipants } from './tournamentsApi'

export function useParticipants(tournamentId: string) {
  return useQuery({
    queryKey: ['tournamentParticipants', tournamentId],
    queryFn: () => listParticipants(tournamentId),
  })
}
