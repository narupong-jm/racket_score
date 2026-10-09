import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMatch,
  getParticipantsForMatches,
  listGamesForMatches,
  listMatches,
  type Match,
  type MatchGame,
  type MatchHistoryEntry,
  type MatchParticipantInput,
} from './matchesApi'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'
import { getQueue, setQueue } from '../../lib/matchQueueStore'

export interface TournamentMatches {
  matches: Match[]
  participants: MatchHistoryEntry[]
  games: MatchGame[]
}

/**
 * All of a tournament's matches plus their participants/game scores, in one
 * query. Multi-court model: a row with status 'queued' is IN PROGRESS on a
 * court (up to tournament.court_count of them at once, each with a
 * court_number); completed rows form the "rounds played" history. The
 * not-yet-started queue of drawn matches is not in the database -- it lives
 * client-side in matchQueueStore until useStartMatchOnCourt promotes its head.
 */
export function useTournamentMatches(tournamentId: string) {
  return useQuery<TournamentMatches>({
    queryKey: ['matches', tournamentId],
    queryFn: async () => {
      const matches = await listMatches(tournamentId)
      const matchIds = matches.map((m) => m.id)
      const [participants, games] = await Promise.all([
        getParticipantsForMatches(matchIds),
        listGamesForMatches(matchIds),
      ])
      return { matches, participants, games }
    },
  })
}

export interface StartMatchOnCourtInput {
  participants: MatchParticipantInput[]
  manuallyAdjusted?: boolean
  courtNumber: number
}

function lineupKey(participants: { playerId: string; team: number }[]): string {
  return participants
    .map((p) => `${p.team}:${p.playerId}`)
    .sort()
    .join('|')
}

/** Removes the first queued entry with the started lineup; no-op if gone. */
function removeStartedEntry(
  tournamentId: string,
  started: MatchParticipantInput[],
) {
  const key = lineupKey(
    started.map((p) => ({ playerId: p.player_id, team: p.team })),
  )
  const current = getQueue(tournamentId)
  const index = current.findIndex(
    (entry) => lineupKey(entry.participants) === key,
  )
  if (index === -1) return
  setQueue(
    tournamentId,
    current.filter((_, i) => i !== index),
  )
}

export function useStartMatchOnCourt(tournamentId: string) {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()

  return useMutation({
    mutationFn: async ({
      participants,
      manuallyAdjusted = false,
      courtNumber,
    }: StartMatchOnCourtInput) => {
      const passphrase = await getPassphrase()
      return createMatch(
        tournamentId,
        courtNumber,
        participants,
        passphrase,
        manuallyAdjusted,
      )
    },
    // Mutation-level (not per-mutate) so it still runs if the component
    // unmounts mid-flight. The started entry is normally the queue head, but
    // the queue can change while the request is in flight (Leave, another tab),
    // so remove the entry that was actually started, not whatever is first now.
    // The returned promise makes React Query wait for the refetches before any
    // call-site onSuccess, so callers see fresh in-progress rosters.
    onSuccess: (_data, { participants }) => {
      removeStartedEntry(tournamentId, participants)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] }),
        queryClient.invalidateQueries({
          queryKey: ['drawInputs', tournamentId],
        }),
      ])
    },
  })
}
