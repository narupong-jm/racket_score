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

function genderImbalance(quartet: CandidatePlayer[]): number {
  const maleCount = quartet.filter((p) => p.gender === 'male').length
  const femaleCount = quartet.length - maleCount
  return Math.abs(maleCount - femaleCount)
}

/**
 * Picks the best 4 players for a doubles match from a candidate pool, in
 * strict priority order:
 * 1. Smallest skill spread (max - min skill value) across the quartet.
 * 2. Among those, the most even gender split (2-2 over 3-1 over 4-0).
 * 3. Random choice among whatever is still tied.
 */
export function pickDoublesQuartet(pool: CandidatePlayer[]): CandidatePlayer[] | null {
  if (pool.length < 4) return null

  const quartets = combinationsOf4(pool)

  const minSpread = Math.min(...quartets.map(skillSpread))
  let candidates = quartets.filter((q) => skillSpread(q) === minSpread)

  const minImbalance = Math.min(...candidates.map(genderImbalance))
  candidates = candidates.filter((q) => genderImbalance(q) === minImbalance)

  return candidates[Math.floor(Math.random() * candidates.length)]
}
