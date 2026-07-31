import type { CandidatePlayer } from './types'

function combinationsOf4(pool: CandidatePlayer[]): CandidatePlayer[][] {
  const result: CandidatePlayer[][] = []
  const n = pool.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        for (let l = k + 1; l < n; l++) {
          result.push([pool[i], pool[j], pool[k], pool[l]])
        }
      }
    }
  }
  return result
}

function skillSpread(quartet: CandidatePlayer[]): number {
  const skills = quartet.map((p) => p.skillValue)
  return Math.max(...skills) - Math.min(...skills)
}

export function genderImbalance(quartet: CandidatePlayer[]): number {
  const maleCount = quartet.filter((p) => p.gender === 'male').length
  const femaleCount = quartet.length - maleCount
  return Math.abs(maleCount - femaleCount)
}

/**
 * Picks the best 4 players for a doubles match from a candidate pool, in
 * strict priority order:
 * 1. Any player in `mandatoryIds` must be included (equal-match-count
 *    invariant, enforced upstream by selectCandidatePool).
 * 2. The most even gender split (2-2 over 3-1 over 4-0) — a hard filter,
 *    not a tiebreak: a 2-male/2-female quartet is always preferred over an
 *    unbalanced one, regardless of skill spread.
 * 3. Among those, the smallest skill spread (max - min skill value).
 * 4. Random choice among whatever is still tied.
 */
export function pickDoublesQuartet(
  pool: CandidatePlayer[],
  mandatoryIds: Set<string> = new Set(),
): CandidatePlayer[] | null {
  if (pool.length < 4) return null

  let quartets = combinationsOf4(pool)
  if (mandatoryIds.size > 0) {
    quartets = quartets.filter((q) =>
      [...mandatoryIds].every((id) => q.some((p) => p.id === id)),
    )
  }
  if (quartets.length === 0) return null

  const minImbalance = Math.min(...quartets.map(genderImbalance))
  let candidates = quartets.filter((q) => genderImbalance(q) === minImbalance)

  const minSpread = Math.min(...candidates.map(skillSpread))
  candidates = candidates.filter((q) => skillSpread(q) === minSpread)

  return candidates[Math.floor(Math.random() * candidates.length)]
}
