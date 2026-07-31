import type { CandidatePlayer, PairingHistory } from './types'
import { canonicalPairKey } from './pairKey'

export type DoublesTeams = [team1: CandidatePlayer[], team2: CandidatePlayer[]]

function makeSplits([p0, p1, p2, p3]: CandidatePlayer[]): DoublesTeams[] {
  return [
    [
      [p0, p1],
      [p2, p3],
    ],
    [
      [p0, p2],
      [p1, p3],
    ],
    [
      [p0, p3],
      [p1, p2],
    ],
  ]
}

function skillSumDiff([team1, team2]: DoublesTeams): number {
  const sum = (team: CandidatePlayer[]) => team.reduce((s, p) => s + p.skillValue, 0)
  return Math.abs(sum(team1) - sum(team2))
}

export function nonMixedTeamCount([team1, team2]: DoublesTeams): number {
  const isMixed = (team: CandidatePlayer[]) => team[0].gender !== team[1].gender
  return (isMixed(team1) ? 0 : 1) + (isMixed(team2) ? 0 : 1)
}

function repeatCount([team1, team2]: DoublesTeams, history: PairingHistory): number {
  const teammateRepeat = (team: CandidatePlayer[]) =>
    history.teammatePairs.has(canonicalPairKey(team[0].id, team[1].id)) ? 1 : 0

  let opponentRepeats = 0
  for (const a of team1) {
    for (const b of team2) {
      if (history.opponentPairs.has(canonicalPairKey(a.id, b.id))) opponentRepeats++
    }
  }

  return teammateRepeat(team1) + teammateRepeat(team2) + opponentRepeats
}

/**
 * Splits a doubles quartet into two teams, evaluating all 3 possible 2v2
 * splits in strict priority order:
 * 1. The most teams that are gender-mixed (1 male + 1 female) — a hard
 *    filter, not a tiebreak: a fully-mixed split is always preferred over
 *    one with a same-gender team, regardless of skill-sum difference.
 * 2. Among those, the smallest skill-sum difference between the teams.
 * 3. Among those, the fewest repeat teammate/opponent pairings.
 * 4. Random choice among whatever is still tied.
 */
export function splitIntoTeams(
  quartet: CandidatePlayer[],
  pairingHistory: PairingHistory,
): DoublesTeams | null {
  if (quartet.length !== 4) return null

  let candidates = makeSplits(quartet)

  const minNonMixed = Math.min(...candidates.map(nonMixedTeamCount))
  candidates = candidates.filter((split) => nonMixedTeamCount(split) === minNonMixed)

  const minSkillDiff = Math.min(...candidates.map(skillSumDiff))
  candidates = candidates.filter((split) => skillSumDiff(split) === minSkillDiff)

  const minRepeats = Math.min(...candidates.map((split) => repeatCount(split, pairingHistory)))
  candidates = candidates.filter((split) => repeatCount(split, pairingHistory) === minRepeats)

  return candidates[Math.floor(Math.random() * candidates.length)]
}
