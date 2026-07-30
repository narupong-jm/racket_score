import { useQuery } from '@tanstack/react-query'
import {
  getParticipantsForMatches,
  listMatches,
  type Match,
  type MatchHistoryEntry,
} from './matchesApi'

export interface QueuedMatch {
  match: Match
  participants: MatchHistoryEntry[]
}

/**
 * The single-court queue for a tournament: at most 2 non-completed matches at
 * once (index 0 = current match being played, index 1 = the pre-queued next one).
 */
export function useMatchQueue(tournamentId: string) {
  return useQuery<QueuedMatch[]>({
    queryKey: ['matches', tournamentId],
    queryFn: async () => {
      const matches = await listMatches(tournamentId)
      const queued = matches
        .filter((m) => m.status === 'queued')
        .sort((a, b) => a.sequence_number - b.sequence_number)

      const participants = await getParticipantsForMatches(queued.map((m) => m.id))

      return queued.map((match) => ({
        match,
        participants: participants.filter((p) => p.match_id === match.id),
      }))
    },
  })
}
