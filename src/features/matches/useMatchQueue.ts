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
import { shiftQueue } from '../../lib/matchQueueStore'

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

export interface StartNextMatchInput {
  participants: MatchParticipantInput[]
  manuallyAdjusted?: boolean
}

/** @deprecated Use useStartMatchOnCourt (court-aware, queue-backed). */
export function useStartNextMatch(tournamentId: string) {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()

  return useMutation({
    mutationFn: async ({
      participants,
      manuallyAdjusted = false,
    }: StartNextMatchInput) => {
      const passphrase = await getPassphrase()
      // Single-court for now; the server assigns sequence_number. Phase 24
      // step 7 replaces this with a court-aware hook.
      return createMatch(
        tournamentId,
        1,
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

export interface StartMatchOnCourtInput {
  participants: MatchParticipantInput[]
  manuallyAdjusted?: boolean
  courtNumber: number
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
    // unmounts mid-flight. The started match is always the queue head. The
    // returned promise makes React Query wait for the refetches before any
    // call-site onSuccess, so callers see fresh in-progress rosters.
    onSuccess: () => {
      shiftQueue(tournamentId)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] }),
        queryClient.invalidateQueries({
          queryKey: ['drawInputs', tournamentId],
        }),
      ])
    },
  })
}
