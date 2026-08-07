import { useQuery } from '@tanstack/react-query'
import { listParticipants } from '../tournaments/tournamentsApi'
import { listPlayerStats } from '../players/playersApi'
import { getMatchHistory, type MatchHistoryEntry } from './matchesApi'
import { resolveSkillValue, type SelfSelectedLevel } from '../matchmaking/resolveSkillValue'
import { canonicalPairKey } from '../matchmaking/pairKey'
import type { CandidatePlayer, PairingHistory } from '../matchmaking/types'

export interface DrawInputs {
  candidates: CandidatePlayer[]
  pairingHistory: PairingHistory
}

export function useDrawInputs(tournamentId: string) {
  return useQuery<DrawInputs>({
    queryKey: ['drawInputs', tournamentId],
    queryFn: () => assembleDrawInputs(tournamentId),
  })
}

export async function assembleDrawInputs(tournamentId: string): Promise<DrawInputs> {
  const [participants, statsList, matchHistory] = await Promise.all([
    listParticipants(tournamentId),
    listPlayerStats(),
    getMatchHistory(tournamentId),
  ])

  const statsById = new Map(statsList.map((s) => [s.player_id, s]))
  const entriesByMatchId = groupByMatchId(matchHistory)

  const matchCountByPlayer = new Map<string, number>()
  for (const entries of entriesByMatchId.values()) {
    for (const playerId of new Set(entries.map((e) => e.player_id))) {
      matchCountByPlayer.set(playerId, (matchCountByPlayer.get(playerId) ?? 0) + 1)
    }
  }

  const pairingHistory = buildPairingHistory(entriesByMatchId)

  const candidates: CandidatePlayer[] = participants
    .filter((participant) => participant.status === 'active')
    .flatMap((participant) => {
      const stats = statsById.get(participant.player_id)
      if (!stats || !stats.gender || !stats.self_selected_level) return []

      return [
        {
          id: participant.player_id,
          gender: stats.gender as CandidatePlayer['gender'],
          skillValue: resolveSkillValue({
            selfSelectedLevel: stats.self_selected_level as SelfSelectedLevel,
            totalMatches: stats.total_matches ?? 0,
            winRate: stats.win_rate,
          }),
          matchesPlayedInTournament:
            (matchCountByPlayer.get(participant.player_id) ?? 0) +
            (participant.match_count_offset ?? 0),
        },
      ]
    })

  return { candidates, pairingHistory }
}

function groupByMatchId(entries: MatchHistoryEntry[]): Map<string, MatchHistoryEntry[]> {
  const map = new Map<string, MatchHistoryEntry[]>()
  for (const entry of entries) {
    const existing = map.get(entry.match_id)
    if (existing) existing.push(entry)
    else map.set(entry.match_id, [entry])
  }
  return map
}

function buildPairingHistory(entriesByMatchId: Map<string, MatchHistoryEntry[]>): PairingHistory {
  const opponentPairs = new Set<string>()
  const teammatePairs = new Set<string>()

  for (const entries of entriesByMatchId.values()) {
    const team1 = entries.filter((e) => e.team === 1).map((e) => e.player_id)
    const team2 = entries.filter((e) => e.team === 2).map((e) => e.player_id)

    if (team1.length === 2) teammatePairs.add(canonicalPairKey(team1[0], team1[1]))
    if (team2.length === 2) teammatePairs.add(canonicalPairKey(team2[0], team2[1]))

    for (const a of team1) {
      for (const b of team2) {
        opponentPairs.add(canonicalPairKey(a, b))
      }
    }
  }

  return { opponentPairs, teammatePairs }
}
