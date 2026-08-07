import type { CandidatePlayer } from './types'

export type SelectCandidatePoolResult =
  | { ok: true; pool: CandidatePlayer[]; mandatoryIds: Set<string> }
  | { ok: false; reason: 'not_enough_players' }

/**
 * Builds the fairness-eligible candidate pool: the players with the fewest
 * matches played in this tournament, expanding to the next-lowest tier
 * (as a whole, never split) until the pool is large enough to draw from.
 *
 * `mandatoryIds` marks players from every tier *before* the last one added —
 * they have strictly fewer matches played than the tier that completed the
 * pool, so the equal-match-count invariant (max - min <= 1) requires they be
 * drawn now rather than skipped in favor of a better skill/gender fit from
 * the last tier. Empty when the lowest tier alone already meets neededCount.
 */
export function selectCandidatePool(
  players: CandidatePlayer[],
  neededCount: number,
): SelectCandidatePoolResult {
  if (players.length < neededCount) {
    return { ok: false, reason: 'not_enough_players' }
  }

  const matchCounts = Array.from(
    new Set(players.map((p) => p.matchesPlayedInTournament)),
  ).sort((a, b) => a - b)

  const pool: CandidatePlayer[] = []
  let lastTierPlayers: CandidatePlayer[] = []
  for (const count of matchCounts) {
    if (pool.length >= neededCount) break
    lastTierPlayers = players.filter(
      (p) => p.matchesPlayedInTournament === count,
    )
    pool.push(...lastTierPlayers)
  }

  const lastTierIds = new Set(lastTierPlayers.map((p) => p.id))
  const mandatoryIds = new Set(
    pool.filter((p) => !lastTierIds.has(p.id)).map((p) => p.id),
  )

  return { ok: true, pool, mandatoryIds }
}
