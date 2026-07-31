import type { CandidatePlayer, MatchType, PairingHistory } from './types'
import { selectCandidatePool } from './selectCandidatePool'
import { pickSinglesPair } from './pickSinglesPair'
import { pickDoublesQuartet } from './pickDoublesQuartet'
import { splitIntoTeams } from './splitIntoTeams'

export interface GeneratedMatchParticipant {
  playerId: string
  team: 1 | 2
}

export type GenerateNextMatchResult =
  | { ok: true; participants: GeneratedMatchParticipant[] }
  | { ok: false; error: 'not_enough_players' }

const NOT_ENOUGH_PLAYERS: GenerateNextMatchResult = { ok: false, error: 'not_enough_players' }

/** Number of players a match of this type needs on the court. */
export function getNeededPlayerCount(type: MatchType): number {
  return type === 'singles' ? 2 : 4
}

/**
 * Draws the next match for a tournament: composes candidate-pool selection,
 * skill/gender-aware pairing (or quartet + team split for doubles), and
 * repeat-pairing avoidance into a single entry point. Never throws — an
 * undersized player pool is reported as an explicit result.
 */
export function generateNextMatch(
  type: MatchType,
  participants: CandidatePlayer[],
  pairingHistory: PairingHistory,
): GenerateNextMatchResult {
  const neededCount = getNeededPlayerCount(type)

  const poolResult = selectCandidatePool(participants, neededCount)
  if (!poolResult.ok) return NOT_ENOUGH_PLAYERS

  if (type === 'singles') {
    const pair = pickSinglesPair(poolResult.pool, pairingHistory, poolResult.mandatoryIds)
    if (!pair) return NOT_ENOUGH_PLAYERS

    const [a, b] = pair
    return {
      ok: true,
      participants: [
        { playerId: a.id, team: 1 },
        { playerId: b.id, team: 2 },
      ],
    }
  }

  const quartet = pickDoublesQuartet(poolResult.pool, poolResult.mandatoryIds)
  if (!quartet) return NOT_ENOUGH_PLAYERS

  const teams = splitIntoTeams(quartet, pairingHistory)
  if (!teams) return NOT_ENOUGH_PLAYERS

  const [team1, team2] = teams
  return {
    ok: true,
    participants: [
      ...team1.map((p) => ({ playerId: p.id, team: 1 as const })),
      ...team2.map((p) => ({ playerId: p.id, team: 2 as const })),
    ],
  }
}
