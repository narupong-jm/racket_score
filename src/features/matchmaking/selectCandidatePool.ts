import type { CandidatePlayer } from './types'

export type SelectCandidatePoolResult =
  | { ok: true; pool: CandidatePlayer[] }
  | { ok: false; reason: 'not_enough_players' }

/**
 * Builds the fairness-eligible candidate pool: the players with the fewest
 * matches played in this tournament, expanding to the next-lowest tier
 * (as a whole, never split) until the pool is large enough to draw from.
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
  for (const count of matchCounts) {
    pool.push(...players.filter((p) => p.matchesPlayedInTournament === count))
    if (pool.length >= neededCount) break
  }

  return { ok: true, pool }
}
