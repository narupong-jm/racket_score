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
import { clearCachedNextDraw } from '../../lib/nextDrawStore'

export interface TournamentMatches {
  matches: Match[]
  participants: MatchHistoryEntry[]
  games: MatchGame[]
}

/**
 * All of a tournament's matches plus their participants/game scores, in one
 * query -- the current match (at most one 'queued' row, per the single-court
 * model) and the completed "rounds played" history are both derived from
 * this by the caller, since "next match" is ephemeral client-side state
 * (not persisted) until "Start match" promotes it via useStartNextMatch.
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

export interface StartNextMatchInput {
  participants: MatchParticipantInput[]
  manuallyAdjusted?: boolean
}

export function useStartNextMatch(tournamentId: string) {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()

  return useMutation({
    mutationFn: async ({
      participants,
      manuallyAdjusted = false,
    }: StartNextMatchInput) => {
      const passphrase = await getPassphrase()
      const matches = await listMatches(tournamentId)
      const nextSequenceNumber =
        matches.reduce((max, m) => Math.max(max, m.sequence_number), 0) + 1
      return createMatch(
        tournamentId,
        nextSequenceNumber,
        participants,
        passphrase,
        manuallyAdjusted,
      )
    },
    onSuccess: () => {
      // Cleared here (mutation-level onSuccess), not only via the
      // mutate()-call-site onSuccess that resets local UI state -- this one
      // is guaranteed to run even if the component unmounts (e.g. the
      // organizer navigates away right as Start match resolves), unlike a
      // per-mutate callback.
      clearCachedNextDraw(tournamentId)
      // Must return this promise: React Query awaits a mutation-level
      // onSuccess before running the mutate()-call-site onSuccess, so the
      // refetched Current-match roster is in the cache before any caller
      // resets Next-match state (which would otherwise re-enable Randomize
      // against a stale/empty exclusion list).
      return queryClient.invalidateQueries({
        queryKey: ['matches', tournamentId],
      })
    },
  })
}
