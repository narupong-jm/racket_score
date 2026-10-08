import type { GeneratedMatchParticipant } from '../matchmaking/generateNextMatch'

/**
 * Joins one side's player names for a drawn (not yet started) match, e.g.
 * "Alice & Bob" -- the queue-side twin of matchFormatting.teamNames.
 */
export function queuedTeamNames(
  participants: GeneratedMatchParticipant[],
  team: 1 | 2,
  playerNameById: Map<string, string>,
): string {
  return participants
    .filter((p) => p.team === team)
    .map((p) => playerNameById.get(p.playerId) ?? p.playerId)
    .join(' & ')
}
