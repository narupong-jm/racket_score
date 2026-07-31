import type { CandidatePlayer, PairingHistory } from './types'
import { canonicalPairKey } from './pairKey'

export type SinglesPair = [CandidatePlayer, CandidatePlayer]

/**
 * Picks the best singles matchup from a candidate pool, in strict priority order:
 * 1. Any player in `mandatoryIds` must be included (equal-match-count
 *    invariant, enforced upstream by selectCandidatePool).
 * 2. Smallest skill gap.
 * 3. Among those, prefer a same-gender pairing over a mixed one (male/female-only
 *    means "mixed" is the one case to avoid when an alternative exists).
 * 4. Among those, prefer opponents who haven't played each other yet, falling back
 *    to a repeat only if every remaining option is a repeat.
 * 5. Random choice among whatever is still tied.
 */
export function pickSinglesPair(
  pool: CandidatePlayer[],
  pairingHistory: PairingHistory,
  mandatoryIds: Set<string> = new Set(),
): SinglesPair | null {
  if (pool.length < 2) return null

  let pairs: SinglesPair[] = []
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      pairs.push([pool[i], pool[j]])
    }
  }

  if (mandatoryIds.size > 0) {
    pairs = pairs.filter(([a, b]) =>
      [...mandatoryIds].every((id) => id === a.id || id === b.id),
    )
  }
  if (pairs.length === 0) return null

  const gapOf = ([a, b]: SinglesPair) => Math.abs(a.skillValue - b.skillValue)
  const minGap = Math.min(...pairs.map(gapOf))
  let candidates = pairs.filter((pair) => gapOf(pair) === minGap)

  const sameGender = candidates.filter(([a, b]) => a.gender === b.gender)
  if (sameGender.length > 0) candidates = sameGender

  const nonRepeat = candidates.filter(
    ([a, b]) => !pairingHistory.opponentPairs.has(canonicalPairKey(a.id, b.id)),
  )
  if (nonRepeat.length > 0) candidates = nonRepeat

  return candidates[Math.floor(Math.random() * candidates.length)]
}
