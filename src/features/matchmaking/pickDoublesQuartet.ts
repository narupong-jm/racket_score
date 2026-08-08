import type { CandidatePlayer, PairingHistory } from './types'
import { canonicalPairKey } from './pairKey'

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
 * Scores how much prior pairing history a quartet's 4 members carry with
 * each other, summed over all C(4,2)=6 internal pairs. At quartet-selection
 * time teams haven't been assigned yet, so a pair counts if it's ever been
 * either opponents or teammates — this can't distinguish the two the way
 * splitIntoTeams's repeatCount does once teams are fixed, but it matches
 * SPEC's "opponents/teams who have not yet played each other" wording, which
 * names both dimensions.
 */
function quartetRepeatExposure(
  quartet: CandidatePlayer[],
  history: PairingHistory,
): number {
  let exposure = 0
  for (let i = 0; i < quartet.length; i++) {
    for (let j = i + 1; j < quartet.length; j++) {
      const key = canonicalPairKey(quartet[i].id, quartet[j].id)
      if (history.opponentPairs.has(key)) exposure++
      if (history.teammatePairs.has(key)) exposure++
    }
  }
  return exposure
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
 * 4. Among those, the quartet whose 4 members carry the least combined prior
 *    pairing history (opponent or teammate) with each other — falls back to
 *    a repeat only when every remaining option has one.
 * 5. Random choice among whatever is still tied.
 */
export function pickDoublesQuartet(
  pool: CandidatePlayer[],
  mandatoryIds: Set<string> = new Set(),
  pairingHistory: PairingHistory,
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

  const minExposure = Math.min(
    ...candidates.map((q) => quartetRepeatExposure(q, pairingHistory)),
  )
  candidates = candidates.filter(
    (q) => quartetRepeatExposure(q, pairingHistory) === minExposure,
  )

  return candidates[Math.floor(Math.random() * candidates.length)]
}
