import { useQuery } from '@tanstack/react-query'
import { listPlayers } from '../players/playersApi'
import { isMemberOfSport } from '../players/playerMembership'
import { listPlayerMatchHistory } from './scoreboardApi'
import {
  aggregateScoreboard,
  type PlayerScoreboardEntry,
} from './aggregateScoreboard'
import type { TournamentType } from '../tournaments/tournamentType'
import type { Sport } from '../sport/sportTypes'

export type ScoreboardPeriod = 'all' | 'month'
export type ScoreboardTypeFilter = 'all' | TournamentType

export function useOverallScoreboard(
  period: ScoreboardPeriod,
  type: ScoreboardTypeFilter,
  sport: Sport,
) {
  return useQuery<PlayerScoreboardEntry[]>({
    queryKey: ['overallScoreboard', period, type, sport],
    queryFn: () => fetchOverallScoreboard(period, type, sport),
  })
}

export async function fetchOverallScoreboard(
  period: ScoreboardPeriod,
  type: ScoreboardTypeFilter,
  sport: Sport,
): Promise<PlayerScoreboardEntry[]> {
  const since = period === 'month' ? startOfCurrentMonthIso() : undefined
  const tournamentType = type === 'all' ? undefined : type

  const [rows, players] = await Promise.all([
    listPlayerMatchHistory({ since, tournamentType, sport }),
    listPlayers(),
  ])

  // Defensive, provably non-hiding filter: a player who has history rows in
  // this result set is kept even if they're no longer a member of `sport`
  // (e.g. removed after playing), so real match data is never dropped from
  // the board.
  const playerIdsWithHistory = new Set(
    rows.flatMap((row) => (row.player_id ? [row.player_id] : [])),
  )
  const members = players.filter(
    (player) =>
      isMemberOfSport(player, sport) || playerIdsWithHistory.has(player.id),
  )

  return aggregateScoreboard(rows, members)
}

function startOfCurrentMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}
