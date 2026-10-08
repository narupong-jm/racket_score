import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import {
  addParticipant,
  createTournament,
  type CreateTournamentInput,
  type Tournament,
} from './tournamentsApi'
import { assembleDrawInputs } from '../matches/useDrawInputs'
import { drawMatches, type PlannedMatch } from '../matchmaking/plannedMatches'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'

/**
 * Thrown when the tournament row was created but a participant failed to
 * attach partway through the loop -- carries the created tournament so the
 * caller can offer recovery (e.g. "retry adding participants") instead of a
 * dead end with an orphaned, empty tournament the user can't get back to.
 */
export class PartialTournamentCreationError extends Error {
  tournament: Tournament

  constructor(tournament: Tournament, cause: unknown) {
    super(
      'Tournament was created, but adding a participant failed partway through.',
    )
    this.name = 'PartialTournamentCreationError'
    this.tournament = tournament
    this.cause = cause
  }
}

export interface CreateTournamentWithFirstDrawInput {
  tournament: CreateTournamentInput
  participantIds: string[]
}

export interface CreateTournamentWithFirstDrawResult {
  tournament: Tournament
  /**
   * The computed first `court_count` matches, in queue order, not yet
   * persisted -- the organizer confirms (optionally editing) via the popup,
   * which writes them to the client-side queue. Empty means not even one
   * match could be drawn (roster smaller than one match).
   */
  drawnMatches: PlannedMatch[]
  /** Players who appear in more than one drawn match (roster too small). */
  reusedPlayerIds: string[]
}

function invalidateAll(queryClient: QueryClient, tournamentId: string) {
  queryClient.invalidateQueries({ queryKey: ['tournaments'] })
  queryClient.invalidateQueries({
    queryKey: ['tournamentParticipants', tournamentId],
  })
  queryClient.invalidateQueries({ queryKey: ['drawInputs', tournamentId] })
  queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
}

export function useCreateTournamentWithFirstDraw() {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()

  return useMutation({
    mutationFn: async ({
      tournament: tournamentInput,
      participantIds,
    }: CreateTournamentWithFirstDrawInput): Promise<CreateTournamentWithFirstDrawResult> => {
      // Resolved once and reused for every write below (tournament creation +
      // the whole participant loop) -- one prompt per logical action, not one
      // per RPC call, matching the "cached for the rest of the session" gate.
      const passphrase = await getPassphrase()
      const tournament = await createTournament(tournamentInput, passphrase)

      for (const playerId of participantIds) {
        try {
          await addParticipant(tournament.id, playerId, passphrase)
        } catch (cause) {
          throw new PartialTournamentCreationError(tournament, cause)
        }
      }

      const drawInputs = await assembleDrawInputs(
        tournament.id,
        tournamentInput.sport,
      )
      const { matches, reusedPlayerIds } = drawMatches(
        tournamentInput.type,
        drawInputs.candidates,
        drawInputs.pairingHistory,
        [],
        tournamentInput.court_count,
      )

      return { tournament, drawnMatches: matches, reusedPlayerIds }
    },
    onSuccess: (result) => {
      invalidateAll(queryClient, result.tournament.id)
    },
    onError: (error) => {
      if (error instanceof PartialTournamentCreationError) {
        invalidateAll(queryClient, error.tournament.id)
      }
    },
  })
}
