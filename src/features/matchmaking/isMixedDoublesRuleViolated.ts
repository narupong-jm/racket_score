import type { CandidatePlayer } from './types'
import { genderImbalance } from './pickDoublesQuartet'
import { nonMixedTeamCount, type DoublesTeams } from './splitIntoTeams'

/**
 * True when a manually-edited doubles lineup breaks the hard mixed-doubles
 * rule that automatic draws (pickDoublesQuartet.ts / splitIntoTeams.ts)
 * enforce: a 2-male/2-female quartet split into a same-gender team, when a
 * fully mixed split was achievable. A quartet that isn't 2-2 to begin with
 * (e.g. 3-1) never violates the rule, since no mixed split is possible.
 *
 * `team1Ids` identifies which 2 of the 4 quartet players are on team 1; the
 * other 2 are assumed to be team 2.
 */
export function isMixedDoublesRuleViolated(
  quartet: CandidatePlayer[],
  team1Ids: string[],
): boolean {
  if (quartet.length !== 4) return false
  if (genderImbalance(quartet) !== 0) return false

  const team1 = quartet.filter((p) => team1Ids.includes(p.id))
  const team2 = quartet.filter((p) => !team1Ids.includes(p.id))
  if (team1.length !== 2 || team2.length !== 2) return false

  const teams: DoublesTeams = [team1, team2]
  return nonMixedTeamCount(teams) > 0
}
