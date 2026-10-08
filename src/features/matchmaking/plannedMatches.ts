import {
  generateNextMatch,
  type GeneratedMatchParticipant,
} from './generateNextMatch'
import { canonicalPairKey } from './pairKey'
import type { CandidatePlayer, MatchType, PairingHistory } from './types'

/** A drawn-but-not-yet-finished match: its participants and teams. */
export type PlannedMatch = GeneratedMatchParticipant[]

/**
 * Folds planned (queued / in-progress) matches into the draw inputs so the next
 * draw treats them as already played: +1 match count per appearance, and their
 * teammate/opponent pairs are added to the pairing history. Pair semantics
 * mirror buildPairingHistory in features/matches/useDrawInputs.ts. Never
 * mutates its inputs.
 */
export function applyPlannedMatches(
  candidates: CandidatePlayer[],
  pairingHistory: PairingHistory,
  planned: PlannedMatch[],
): { candidates: CandidatePlayer[]; pairingHistory: PairingHistory } {
  const appearances = new Map<string, number>()
  const opponentPairs = new Set(pairingHistory.opponentPairs)
  const teammatePairs = new Set(pairingHistory.teammatePairs)

  for (const match of planned) {
    for (const { playerId } of match) {
      appearances.set(playerId, (appearances.get(playerId) ?? 0) + 1)
    }

    const team1 = match.filter((p) => p.team === 1).map((p) => p.playerId)
    const team2 = match.filter((p) => p.team === 2).map((p) => p.playerId)

    if (team1.length === 2)
      teammatePairs.add(canonicalPairKey(team1[0], team1[1]))
    if (team2.length === 2)
      teammatePairs.add(canonicalPairKey(team2[0], team2[1]))

    for (const a of team1) {
      for (const b of team2) {
        opponentPairs.add(canonicalPairKey(a, b))
      }
    }
  }

  return {
    candidates: candidates.map((c) => ({
      ...c,
      matchesPlayedInTournament:
        c.matchesPlayedInTournament + (appearances.get(c.id) ?? 0),
    })),
    pairingHistory: { opponentPairs, teammatePairs },
  }
}

/**
 * Unique ids of drawn players who already appear in a planned match, in order
 * of first appearance in `drawn`.
 */
export function findReusedPlayerIds(
  drawn: GeneratedMatchParticipant[],
  planned: PlannedMatch[],
): string[] {
  const plannedIds = new Set(planned.flatMap((m) => m.map((p) => p.playerId)))
  const reused: string[] = []
  for (const { playerId } of drawn) {
    if (plannedIds.has(playerId) && !reused.includes(playerId)) {
      reused.push(playerId)
    }
  }
  return reused
}

export interface DrawMatchesResult {
  matches: PlannedMatch[]
  reusedPlayerIds: string[]
  stoppedEarly: boolean
}

/**
 * Draws up to `count` matches one at a time; each drawn match counts as
 * planned for the next draw. `planned` (already queued / in-progress matches)
 * is respected but not included in the returned `matches`.
 */
export function drawMatches(
  type: MatchType,
  candidates: CandidatePlayer[],
  pairingHistory: PairingHistory,
  planned: PlannedMatch[],
  count: number,
): DrawMatchesResult {
  const matches: PlannedMatch[] = []
  const reusedPlayerIds: string[] = []
  let stoppedEarly = false

  for (let i = 0; i < count; i++) {
    const currentPlanned = [...planned, ...matches]
    const inputs = applyPlannedMatches(
      candidates,
      pairingHistory,
      currentPlanned,
    )
    const result = generateNextMatch(
      type,
      inputs.candidates,
      inputs.pairingHistory,
    )
    if (!result.ok) {
      stoppedEarly = true
      break
    }
    for (const id of findReusedPlayerIds(result.participants, currentPlanned)) {
      if (!reusedPlayerIds.includes(id)) reusedPlayerIds.push(id)
    }
    matches.push(result.participants)
  }

  return { matches, reusedPlayerIds, stoppedEarly }
}
