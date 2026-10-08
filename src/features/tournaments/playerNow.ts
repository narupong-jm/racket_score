import type { PlannedMatch } from '../matchmaking/plannedMatches'

export interface PlayerNow {
  /** Court the player is currently playing on, or null. */
  court: number | null
  /** 1-based queue positions of the OTHER queued matches the player is in. */
  queuePositions: number[]
}

/**
 * Where a player currently is, for the queue Edit popup's "Now" column: the
 * court they are playing on and/or the queue positions they hold, ignoring
 * the queue entry being edited.
 */
export function getPlayerNow(
  playerId: string,
  onCourts: { courtNumber: number; roster: PlannedMatch }[],
  queue: PlannedMatch[],
  editingIndex: number,
): PlayerNow {
  const court =
    onCourts.find((c) => c.roster.some((p) => p.playerId === playerId))
      ?.courtNumber ?? null
  const queuePositions = queue.flatMap((roster, index) =>
    index !== editingIndex && roster.some((p) => p.playerId === playerId)
      ? [index + 1]
      : [],
  )
  return { court, queuePositions }
}
