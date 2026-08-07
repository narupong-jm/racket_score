import { useQuery } from '@tanstack/react-query'
import { listPlayers } from '../players/playersApi'
import { listPlayerMatchHistory } from './scoreboardApi'
import {
  aggregateScoreboard,
  type PlayerScoreboardEntry,
} from './aggregateScoreboard'
import type { TournamentType } from '../tournaments/tournamentType'

export type ScoreboardPeriod = 'all' | 'month'
export type ScoreboardTypeFilter = 'all' | TournamentType

export function useOverallScoreboard(
  period: ScoreboardPeriod,
  type: ScoreboardTypeFilter,
) {
  return useQuery<PlayerScoreboardEntry[]>({
    queryKey: ['overallScoreboard', period, type],
    queryFn: () => fetchOverallScoreboard(period, type),
  })
}

export async function fetchOverallScoreboard(
  period: ScoreboardPeriod,
  type: ScoreboardTypeFilter,
): Promise<PlayerScoreboardEntry[]> {
  const since = period === 'month' ? startOfCurrentMonthIso() : undefined
  const tournamentType = type === 'all' ? undefined : type

  const [rows, players] = await Promise.all([
    listPlayerMatchHistory({ since, tournamentType }),
    listPlayers(),
  ])

  return aggregateScoreboard(rows, players)
}

function startOfCurrentMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}
