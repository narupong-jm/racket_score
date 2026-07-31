import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  addParticipant,
  createTournament,
  type CreateTournamentInput,
  type Tournament,
} from './tournamentsApi'
import { assembleDrawInputs } from '../matches/useDrawInputs'
import { generateNextMatch, type GeneratedMatchParticipant } from '../matchmaking/generateNextMatch'

/**
 * Thrown when the tournament row was created but a participant failed to
 * attach partway through the loop -- carries the created tournament so the
 * caller can offer recovery (e.g. "retry adding participants") instead of a
 * dead end with an orphaned, empty tournament the user can't get back to.
 */
export class PartialTournamentCreationError extends Error {
  tournament: Tournament

  constructor(tournament: Tournament, cause: unknown) {
    super('Tournament was created, but adding a participant failed partway through.')
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
   * The computed first-match draw, not yet persisted -- per the
   * deferred-persistence design (mirroring the Next-match card), the
   * organizer confirms (optionally editing it first) via the first-match
   * popup before it's written as a real `matches` row. `null` means the draw
   * itself failed (not enough players), so there's nothing to confirm.
   */
  drawParticipants: GeneratedMatchParticipant[] | null
}

function invalidateAll(queryClient: QueryClient, tournamentId: string) {
  queryClient.invalidateQueries({ queryKey: ['tournaments'] })
  queryClient.invalidateQueries({ queryKey: ['tournamentParticipants', tournamentId] })
  queryClient.invalidateQueries({ queryKey: ['drawInputs', tournamentId] })
  queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
}

export function useCreateTournamentWithFirstDraw() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      tournament: tournamentInput,
      participantIds,
    }: CreateTournamentWithFirstDrawInput): Promise<CreateTournamentWithFirstDrawResult> => {
      const tournament = await createTournament(tournamentInput)

      for (const playerId of participantIds) {
        try {
          await addParticipant(tournament.id, playerId)
        } catch (cause) {
          throw new PartialTournamentCreationError(tournament, cause)
        }
      }

      const drawInputs = await assembleDrawInputs(tournament.id)
      const drawResult = generateNextMatch(
        tournamentInput.type,
        drawInputs.candidates,
        drawInputs.pairingHistory,
      )

      if (!drawResult.ok) {
        // Unreachable in practice for an exactly-sized, freshly-added pool
        // (verified against selectCandidatePool/pickDoublesQuartet/
        // splitIntoTeams), but still handled defensively rather than assumed
        // away -- the caller can show a "not drawn yet" state for this case.
        return { tournament, drawParticipants: null }
      }

      return { tournament, drawParticipants: drawResult.participants }
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
